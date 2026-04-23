//! Codex Switcher - Multi-account manager for Codex CLI

pub mod api;
pub mod auth;
pub mod commands;
pub mod types;
pub mod web;

use commands::{
    add_account_from_file, cancel_login, check_codex_processes, complete_login, delete_account,
    export_accounts_full_encrypted_file, export_accounts_slim_text, get_active_account_info,
    get_masked_account_ids, get_usage, import_accounts_full_encrypted_file,
    import_accounts_slim_text, list_accounts, refresh_all_accounts_usage, rename_account,
    set_masked_account_ids, start_login, switch_account, warmup_account, warmup_all_accounts,
};
use commands::tray::refresh_tray;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // ── Build tray menu ───────────────────────────────────────────
            let show_i = MenuItemBuilder::new("Open Codex Switcher")
                .id("show")
                .build(app)?;

            let refresh_i = MenuItemBuilder::new("Refresh Usage")
                .id("refresh")
                .build(app)?;

            let sep = PredefinedMenuItem::separator(app)?;

            let quit_i = MenuItemBuilder::new("Quit")
                .id("quit")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_i)
                .item(&refresh_i)
                .item(&sep)
                .item(&quit_i)
                .build()?;

            // ── Create tray icon ─────────────────────────────────────────
            // Start with a plain circle (no usage yet); will refresh after init
            let initial_icon_bytes = commands::tray::generate_tray_icon_png(None);
            let initial_icon = tauri::image::Image::from_bytes(&initial_icon_bytes)
                .expect("Failed to create initial tray icon");

            let _tray = TrayIconBuilder::with_id("main")
                .icon(initial_icon)
                .tooltip("Codex Switcher")
                .menu(&menu)
                .show_menu_on_left_click(false) // macOS: left-click opens window, right-click = menu
                .on_menu_event(|app: &AppHandle, event| {
                    match event.id.as_ref() {
                        "show" => show_main_window(app),
                        "refresh" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                refresh_tray(&app).await;
                            });
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click → show/focus the main window
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Kick off initial tray refresh (non-blocking)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                refresh_tray(&app_handle).await;
            });

            // Background tray refresh loop (every 60 seconds)
            let app_handle2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                    refresh_tray(&app_handle2).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Account management
            list_accounts,
            get_active_account_info,
            add_account_from_file,
            switch_account,
            delete_account,
            rename_account,
            export_accounts_slim_text,
            import_accounts_slim_text,
            export_accounts_full_encrypted_file,
            import_accounts_full_encrypted_file,
            // Masked accounts
            get_masked_account_ids,
            set_masked_account_ids,
            // OAuth
            start_login,
            complete_login,
            cancel_login,
            // Usage
            get_usage,
            refresh_all_accounts_usage,
            warmup_account,
            warmup_all_accounts,
            // Process detection
            check_codex_processes,
            // Tray trigger from frontend
            trigger_tray_refresh,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Reveal and focus the main application window
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        let _ = window.unminimize();
    }
}

/// Tauri command that the frontend can call to trigger a tray refresh
/// (e.g., after switching accounts or refreshing usage in the UI)
#[tauri::command]
async fn trigger_tray_refresh(app: AppHandle) {
    refresh_tray(&app).await;
}
