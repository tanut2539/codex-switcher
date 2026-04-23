//! Tray icon rendering and update helpers for macOS status bar

use crate::auth::load_accounts;
use crate::api::usage::get_account_usage;
use image::{ImageBuffer, Rgba, RgbaImage};
use std::f64::consts::PI;
use tauri::AppHandle;

/// Active account status returned to the tray
#[derive(Debug, Clone, serde::Serialize)]
pub struct TrayStatus {
    pub account_name: Option<String>,
    pub primary_remaining_pct: Option<f64>,
    pub secondary_remaining_pct: Option<f64>,
    pub credits_balance: Option<String>,
    pub plan_type: Option<String>,
}

/// Fetch the current active account and its usage, then return tray status
pub async fn get_tray_status() -> TrayStatus {
    let store = match load_accounts() {
        Ok(s) => s,
        Err(_) => return TrayStatus::empty(),
    };

    let active_id = match &store.active_account_id {
        Some(id) => id.clone(),
        None => return TrayStatus::empty(),
    };

    let active_account = match store.accounts.iter().find(|a| a.id == active_id) {
        Some(a) => a.clone(),
        None => return TrayStatus::empty(),
    };

    let name = active_account.name.clone();
    let usage = get_account_usage(&active_account).await.ok();

    match usage {
        Some(u) => TrayStatus {
            account_name: Some(name),
            primary_remaining_pct: u.primary_used_percent.map(|p| (100.0 - p).max(0.0)),
            secondary_remaining_pct: u.secondary_used_percent.map(|p| (100.0 - p).max(0.0)),
            credits_balance: u.credits_balance,
            plan_type: u.plan_type,
        },
        None => TrayStatus {
            account_name: Some(name),
            primary_remaining_pct: None,
            secondary_remaining_pct: None,
            credits_balance: None,
            plan_type: None,
        },
    }
}

impl TrayStatus {
    fn empty() -> Self {
        TrayStatus {
            account_name: None,
            primary_remaining_pct: None,
            secondary_remaining_pct: None,
            credits_balance: None,
            plan_type: None,
        }
    }
}

/// Build the tooltip string shown on hover over the status bar icon
pub fn build_tooltip(status: &TrayStatus) -> String {
    let name = status
        .account_name
        .as_deref()
        .unwrap_or("No active account");

    let remaining = status
        .secondary_remaining_pct
        .or(status.primary_remaining_pct);

    match remaining {
        Some(pct) => format!("{name} — {:.0}% remaining", pct),
        None => format!("{name} — usage unknown"),
    }
}

/// Build the tray menu title string
pub fn build_menu_title(status: &TrayStatus) -> String {
    let name = status
        .account_name
        .as_deref()
        .unwrap_or("No active account");

    let remaining = status
        .secondary_remaining_pct
        .or(status.primary_remaining_pct);

    match remaining {
        Some(pct) => format!("{name}  {:.0}%", pct),
        None => name.to_string(),
    }
}

// ─── Icon Generation ───────────────────────────────────────────────────────

const ICON_SIZE: u32 = 22;

/// Generate a circular usage indicator PNG.
///
/// - Outer ring = full circle (background, semi-transparent)
/// - Inner arc   = remaining usage in bright green/amber/red
/// - Center label = percentage (skipped at 22px — too small; kept for future HiDPI)
pub fn generate_tray_icon_png(remaining_pct: Option<f64>) -> Vec<u8> {
    let size = ICON_SIZE;
    let mut img: RgbaImage = ImageBuffer::new(size, size);

    let cx = size as f64 / 2.0;
    let cy = size as f64 / 2.0;
    let r_outer = (size as f64 / 2.0) - 1.5;
    let r_inner = r_outer - 3.5;

    // Background ring color (dark gray, semi-transparent)
    let bg_color = Rgba([180u8, 180, 180, 120]);

    // Arc color based on remaining percentage
    let arc_color = match remaining_pct {
        Some(p) if p > 40.0 => Rgba([52u8, 199, 89, 255]),    // green
        Some(p) if p > 15.0 => Rgba([255u8, 159, 10, 255]),   // amber
        Some(_) => Rgba([255u8, 69, 58, 255]),                  // red
        None => Rgba([142u8, 142, 147, 200]),                   // gray unknown
    };

    // Fraction of arc to draw (remaining)
    let fraction = remaining_pct.unwrap_or(0.0) / 100.0;

    // Draw each pixel using anti-aliased ring approach
    for py in 0..size {
        for px in 0..size {
            let dx = px as f64 + 0.5 - cx;
            let dy = py as f64 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist < r_inner || dist > r_outer {
                continue;
            }

            // Determine angle (0 = top, going clockwise)
            let angle_rad = dy.atan2(dx) + PI / 2.0;
            let norm_angle = if angle_rad < 0.0 {
                angle_rad + 2.0 * PI
            } else {
                angle_rad
            };
            let t = norm_angle / (2.0 * PI); // 0..1

            let pixel = img.get_pixel_mut(px, py);
            if t <= fraction {
                // Remaining arc
                *pixel = blend_pixel(*pixel, arc_color, aa_factor(dist, r_inner, r_outer));
            } else {
                // Background ring
                *pixel = blend_pixel(*pixel, bg_color, aa_factor(dist, r_inner, r_outer));
            }
        }
    }

    // Encode to PNG bytes
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .expect("PNG encoding failed");
    buf.into_inner()
}

fn aa_factor(dist: f64, r_inner: f64, r_outer: f64) -> f64 {
    let edge_width = 0.8;
    let inner_alpha = ((dist - r_inner) / edge_width).clamp(0.0, 1.0);
    let outer_alpha = ((r_outer - dist) / edge_width).clamp(0.0, 1.0);
    inner_alpha.min(outer_alpha)
}

fn blend_pixel(base: Rgba<u8>, overlay: Rgba<u8>, alpha: f64) -> Rgba<u8> {
    let a = (overlay[3] as f64 * alpha) as u8;
    let inv = 255u8.saturating_sub(a) as f64 / 255.0;
    let fwd = a as f64 / 255.0;
    Rgba([
        (base[0] as f64 * inv + overlay[0] as f64 * fwd) as u8,
        (base[1] as f64 * inv + overlay[1] as f64 * fwd) as u8,
        (base[2] as f64 * inv + overlay[2] as f64 * fwd) as u8,
        (base[3] as f64 + a as f64 * (1.0 - base[3] as f64 / 255.0)) as u8,
    ])
}

/// Refresh the tray icon and tooltip from the current active account status.
pub async fn refresh_tray(app: &AppHandle) {
    let status = get_tray_status().await;

    let tooltip = build_tooltip(&status);

    let remaining = status
        .secondary_remaining_pct
        .or(status.primary_remaining_pct);

    let icon_bytes = generate_tray_icon_png(remaining);

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&tooltip));
        if let Ok(icon) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }

        // Update the title label next to the icon (macOS only)
        #[cfg(target_os = "macos")]
        {
            let title = match (&status.account_name, remaining) {
                (Some(name), Some(pct)) => format!("{}  {:.0}%", name, pct),
                (Some(name), None) => name.clone(),
                (None, _) => String::new(),
            };
            let _ = tray.set_title(Some(&title));
        }
    }
}
