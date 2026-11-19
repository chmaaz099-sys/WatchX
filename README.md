# WatchX Cinema - The Ultimate Movie Streaming Platform

WatchX is a luxury, billion-dollar-grade movie and television streaming platform built with a **strict pure black monochromatic design system** (`#000000`, `#080808`, `#0D0D0D`, `#141414`), a **Netflix-style multi-profile system**, **cryptographic 4-digit profile PIN security**, **real user accounts & Google OAuth**, **Supabase PostgreSQL cloud synchronization**, and an extensive **10,000+ movie & TV show discovery catalog**.

---

## 🖤 Design Philosophy: Strict Pure Black Monochrome

WatchX enforces an Apple-level minimalist, cinema-grade monochromatic aesthetic:
- **Background:** `#000000` (Pure Black)
- **Secondary Surfaces:** `#080808`
- **Cards & Tiles:** `#0D0D0D`
- **Elevated Surfaces & Modals:** `#141414`
- **Borders & Dividers:** `#202020` / `#333333`
- **Primary Text & White Buttons:** `#FFFFFF`
- **Secondary Text:** `#A0A0A0`
- **Muted Elements:** `#666666`
- **Zero Color Clutter:** Absolutely no red, blue, green, orange, purple, or colorful gradients. Movie posters and artwork retain their natural vivid colors while the UI remains timelessly monochromatic.

---

## 💎 Core Platform Capabilities

### 1. Clutter-Free Cinema Video Player
- **Zero Technical Badges or Provider Names:** Backend streaming providers (`VidSrc`, `MultiEmbed`, etc.) and technical latency pills (`~400ms`) are completely hidden from the user interface.
- **Cinematic Top Bar:** Minimalist navigation showing `< Back`, Title, Season/Episode info, Audio/Subtitles indicator, Episode jumper (for TV), and Fullscreen (`F`).
- **Seamless Silent Failover:** Multiple authorized providers are handled in the background automatically.

### 2. Real User Authentication & Google OAuth
- **Supabase Auth & Cloud Integration:** Supports real Email/Password signup, signin, account recovery, and Google OAuth.
- **Zero-Friction Local Fallback:** When offline or before cloud credentials are configured, WatchX automatically runs on a high-performance local database repository with identical async semantics, so **all buttons work immediately**.
- **Cross-Device Cloud Sync:** Enter your Supabase Project URL and Anon Key in **Settings > Supabase Cloud Sync** to test the connection and sync all local profiles and watchlists to PostgreSQL!

### 3. Netflix-Style Multiple Working Profiles
- **"Who's Watching?" Screen:** Full-screen profile selector with smooth avatar zoom and profile status badges.
- **Up to 5 Custom Profiles per Account:** Each profile has its own:
  - Custom name and avatar (choose from 12 curated avatars or upload your own photo).
  - Individual profile watchlist (`watchlists`).
  - Individual Continue Watching history (`watch_history`).
  - Profile-specific settings and playback preferences.
- **Manage Profiles Mode:** Easily edit profile names, change avatars, configure security PINs, or delete profiles.

### 4. Cryptographic 4-Digit Profile PIN Security
- **Web Crypto SHA-256 Hashing:** Profile PINs are salted with a 16-byte cryptographically secure salt and hashed using `window.crypto.subtle.digest('SHA-256', ...)`. PINs are **never** stored as plain text.
- **Rate-Limiting Protection:** Locked out for 30 seconds after 5 failed attempts with a live countdown timer.
- **Custom Keypad & Keyboard Support:** Full support for physical keyboards (0-9, Backspace, Enter) and an on-screen virtual keypad with shake animations on invalid attempts.

### 5. 10,000+ Movies & TV Shows Discovery Engine
- **Deep TMDB Catalog:** Seamless pagination across pages 1 to 500+ (over 10,000 titles).
- **Multi-Filter Toolbar:** Filter by 18+ Genres (Action, Sci-Fi, Horror, Comedy, Drama, Animation, etc.), Release Year (2025 to Classics), and Sort By (Popularity, Highest Rated, Newest Releases).
- **Dedicated TV Show Browser:** Full season and episode selector with episode thumbnails, runtimes, overviews, and one-click play.
- **Instant Search:** Debounced instant search with search history chips and multi-type filtering.

### 6. Precision Non-Random Playback Tracking
- Real-time 1-second ticker tracks exact seconds elapsed.
- Automatically saves playback progress to the active profile's watch history.
- Cards in *Continue Watching* display exact stopped timestamps: `Stopped at 18:24 (25%)` and automatically resume from that exact second.

### 7. Malicious Ad & Redirect Shield (Root-Cause Security Architecture)
- **Zero Injected Popups & Overlays:** The root cause of unwanted popups, fake CAPTCHAs, and redirects in third-party streams has been completely eradicated through a multi-tiered security defense:
  - **Strict W3C Iframe Sandboxing:** The video player runs under `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"`. By strictly omitting `allow-popups`, `allow-top-navigation`, `allow-top-navigation-by-user-activation`, and `allow-modals`, the browser engine categorically rejects any rogue attempt to spawn new tabs, trigger popunders, display fake virus/phone prompts, or redirect the page.
  - **Content Security Policy (CSP):** The application enforces a strict Content Security Policy restricting `frame-src` exclusively to approved video streams and YouTube NoCookie.
  - **Client-Side Anti-Hijack Guard:** Overrides `window.open` at the top level to intercept any rogue popup requests while protecting legitimate OAuth sign-in popups.
  - **Clean Authorized Streams:** Upgraded to VidLink Pro (with custom dark theme parameters `primaryColor=ffffff&secondaryColor=141414&iconColor=ffffff&icons=default`), VidSrc CC v2, Embed.su, AutoEmbed CC, and YouTube NoCookie.
  - **Discreet Server Switcher:** Minimalist `Server 1`, `Server 2` switcher in the player header allows instant stream rotation without exposing technical provider names.

### 8. 240Hz Extreme Performance Engine (High Refresh Rate Ready)
- **High Refresh Rate Support:** Engineered for native 60Hz, 120Hz, 144Hz, 165Hz, and 240Hz displays.
- **Hardware Acceleration & GPU Compositing:** Every movie card utilizes `contain: layout paint;`, `content-visibility: auto;`, `contain-intrinsic-size: 185px 280px;`, and `transform: translate3d(0, 0, 0);` to eliminate layout recalculations and ensure butter-smooth 240 FPS rendering across thousands of titles.
- **Liquid 240Hz RAF Carousel Scroller:** Smooth scrolling driven by `requestAnimationFrame` with quartic easing curves, triggered via elegant left/right chevron navigation buttons on every content row.
- **Asynchronous Image Decoding:** All movie posters use `loading="lazy" decoding="async"` to prevent main-thread jank during high-speed scrolling.
- **Real-Time Performance HUD:** Toggleable with `Shift + F` or in Settings > Preferences, displaying live FPS, frame time (e.g. 4.16ms on 240Hz displays), and detected display refresh rate.

---

## 🗄️ Supabase PostgreSQL Setup & Google OAuth

### 1. Initialize PostgreSQL Schema
1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab.
3. Open `supabase-schema.sql` in this repository, paste its contents into the editor, and click **Run**.
4. All tables (`profiles`, `watchlists`, `watch_history`, `user_preferences`) and Row Level Security (RLS) policies will be created automatically.

### 2. Configure Google OAuth in Supabase
1. In the Supabase Dashboard, go to **Authentication > Providers > Google**.
2. Toggle Google to **Enabled**.
3. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create an **OAuth 2.0 Client ID** (Web application).
   - Add your Supabase Callback URL (e.g. `https://<your-project>.supabase.co/auth/v1/callback`) to **Authorized redirect URIs**.
4. Copy the **Client ID** and **Client Secret** into your Supabase Google Provider settings and click **Save**.

### 3. Connect WatchX to Supabase
1. Open WatchX in your browser.
2. Click the profile avatar in the top right > **Account & Settings**.
3. Select **Supabase Cloud Sync**.
4. Enter your **Project URL** and **Anon Key**.
5. Click **Test Connection** to verify latency, then click **Save Credentials**.

---

## 🚀 How to Run Locally

```powershell
# Navigate to the project directory
cd "C:\Users\AL-MAKKAH\.gemini\antigravity\scratch\netout-stream-app"

# Start the local server on port 3333
python -m http.server 3333
```

Open in your browser:  
👉 **`http://localhost:3333/`**

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus Instant Search |
| `Space` | Play Hero Spotlight Title |
| `F` | Toggle Fullscreen Video Player |
| `Shift + F` | Toggle 240Hz Performance HUD (FPS & Refresh Rate) |
| `M` | Mute / Unmute Acoustic Feedback |
| `N` | Next Episode (TV Series) |
| `P` | Previous Episode (TV Series) |
| `Esc` | Close Player or Modal |
| `?` | Open Keyboard Shortcuts Help |
