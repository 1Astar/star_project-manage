> **Star 入库说明**：本文件为 `miniscloud-ui-design` 完整正文。入口见同目录 `SKILL.md`。
> PC 原型窗壳（Web 实现 + 原生窗观感）见 `miniscloud-prd-agents`；本文件管窗口内部 UI。
> 旧名 `Design-SKILL.md` 指向本文件。产品分域：仅 MinisCloud OS，不覆盖 Lab / 通用 Star。

SKILL: MinisCloud OS UI Design System

1. Skill Name
miniscloud-ui-design

2. Description
You are a UI design assistant for MinisCloud OS, a consumer-facing NAS operating system with both a PC web client and a iOS mobile app.
When this skill is active, every design decision you make — layout, color, typography, component choice, interaction pattern, copy — must conform to the MinisCloud OS Design System described in this document.
You do not copy existing pages. You do apply these rules to create new, consistent, never-before-seen screens that feel native to this product.
This skill supersedes any general design instincts you have. When in conflict, this document wins.

3. When to Use
Activate this skill whenever the user asks you to:
	•	Design a new page, screen, or view
	•	Design a new feature flow (multi-step forms, settings panels, wizards)
	•	Design a new component (modals, drawers, tables, cards, forms)
	•	Design a new empty state, error state, or loading state
	•	Review or critique a proposed design for consistency
	•	Write copy or microcopy for UI elements
	•	Decide between two design options
Do not use this skill for:
	•	Writing backend logic or API specifications
	•	Creating marketing materials or landing pages (different visual language)
	•	Designing native macOS/Windows desktop apps (this is a web UI)

4. Design Tokens
Apply these values every time you specify a color, size, radius, shadow, or animation. Never invent a new value — always reach for the nearest token.
4.1 Color
Primary (Blue) — Action Signal

Primary:           #3D86F8
Primary Light:     #8BB7FB
Primary Gradient:  linear-gradient(to left, #3D86F8, #8BB7FB)
Primary BG:        rgba(61,134,248,0.10)   ← badge, chip backgrounds
Primary BG Subtle: rgba(61,134,248,0.03)   ← table row tint
Status Colors

Success:           #079F4A   ← completed, shared space, public network online
Success Alt:       #07D100   ← download speed arrow
Success Online:    #17A857   ← history connection "public online"
Success BG:        rgba(7,159,74,0.07)
Danger:            #E11D48   ← delete button, error messages, irreversible actions
Danger Icon:       #E40303   ← delete icon stroke
Danger BG:         rgba(225,29,72,0.10)    ← swipe-to-delete zone
Text

Text Primary:      #031121   ← main text
Text Secondary:    rgba(3,17,33,0.70)     ← descriptions, subtitles
Text Tertiary:     rgba(3,17,33,0.40)     ← disabled links, "skip", "previous step"
Text Placeholder:  #BFC3C6   ← input placeholders
Text Meta:         #414A54   ← IP, username, date labels
Text Disabled:     rgba(65,74,84,0.40)    ← offline device text
Text OnDark:       #FFFFFF   ← text on dark/overlay backgrounds
Text Link:         #3D86F8   ← clickable text links
Text Danger:       #E11D48   ← inline error text
Text Success:      #079F4A   ← inline success text
Borders & Dividers

Border Input:      rgba(191,195,198,0.60)  ← input default
Border Focus:      rgba(3,17,33,0.70)      ← input focused
Border Checkbox:   #C4C4C4
Divider:           rgba(98,116,142,0.08)   ← thin divider (PC)
Divider Mid:       rgba(98,116,142,0.10)   ← medium divider
Divider Dialog:    #E7E7E7                 ← dialog footer separator
Backgrounds

BG Page Mobile:    #EAF2F8   ← form and result pages (mobile)
BG Page History:   #E1EAF1   ← history/list pages (mobile)
BG Card:           #F2F9FE   ← card, drawer, modal, submenu
BG Card Dialog:    #E9F1F7   ← dialog, context menu (slightly darker)
BG Window PC:      #F2F9FE at 70% opacity  ← PC root window glass layer
BG PC Content:     #FFFFFF at 48% opacity  ← PC right content glass base
BG PC Content Soft: #FFFFFF at 12% opacity ← PC right content soft glass overlay
BG PC Edge Glow:   #00A2F2 at 10% opacity  ← PC content top/bottom gradient overlays
BG Input:          rgba(237,245,251,0.20)  ← input field fill
BG Overlay Mobile: rgba(0,0,0,0.15)        ← full-screen backdrop + 12px blur
BG Overlay PC:     rgba(0,0,0,0.15)        ← parent-window backdrop, no blur
BG Toast:          rgba(0,0,0,0.60)        ← toast background
4.2 Typography
Font Families

Brand Font:   'Afacad Flux', sans-serif    ← ONLY for "MinisCloud OS" logotype on splash screen
UI Font:      'PingFang SC', sans-serif    ← EVERYTHING else
Font Weights

Light:    300   ← subtitle copy, long-form body text
Regular:  400   ← general text, list items, descriptions
Medium:   500   ← titles, button labels, emphasized content
Semibold: 600   ← forced dialog title only (use sparingly)
Type Scale

Display:  30px / Afacad Flux Medium   → brand title on splash only
H1:       24px / PingFang SC Medium   → page title (registration, reset)
H2:       18px / PingFang SC Medium   → modal title, device name
H3:       16px / PingFang SC Medium   → nav title, service name
Body-L:   14px / Medium or Regular   → body text, button labels, input values
Body-M:   12px / Regular or Medium   → helper text, status tags, badges
Caption:  10px / Regular             → footnotes, version numbers, disclaimers
Line Heights

Tight:    1.2    ← headings
Normal:   1.4    ← body minimum
Relaxed:  1.5    ← nav titles, registration headings
Toast:    22px   ← fixed value for toast text
4.3 Spacing
Page-Level

Mobile horizontal padding:   28px (left + right safe margin)
PC content padding:          24px
PC sidebar padding:          13px
Component-Level

Input height (mobile):       50px
Input height (PC):           44px
Input icon start:            x = 40px
Input text start:            x = 70px
Button height (mobile):      50px
Button height (PC):          44px
Button full width (mobile):  319px  (375 - 56)
Button padding x:            16px
Button padding y:            12px
Pill button padding x:       14px
Pill button padding y:       6px
Badge padding x:             8px
Badge padding y:             3px
Icon-to-text gap:            8px
Checkbox size:               12px
System-Level

Status bar height:           44px
Navbar total height:         104px
Home indicator zone:         34px
Drawer start Y (mobile):     363px
Drawer height (mobile):      449px
4.4 Border Radius

xs:     2px      ← checkbox
sm:     4.6px    ← iOS keyboard key
md:     8px      ← small buttons, dialog inner buttons
lg:     12px     ← main buttons, inputs, PC card rows      ← DEFAULT for interactive elements
xl:     18px     ← mobile device history cards
2xl:    24px     ← mobile large cards, bottom drawer (top corners only)
3xl:    26px     ← PC app main window
4xl:    28px     ← PC secondary dialog
pill:   100px    ← progress bar, status strip
full:   10000px  ← pill buttons, status badges
Semantic Aliases

radius.button    = lg  (12px)
radius.input     = lg  (12px)
radius.card      = lg  (12px) for PC / xl (18px) for Mobile device cards
radius.modal     = 2xl (24px)
radius.drawer    = 2xl (24px, top corners only)
radius.badge     = full
radius.progress  = pill
Rule: Inner radius ≤ Outer radius. A component inside a 24px card must not use radius > 12px.
4.5 Shadows

App Icon:      0 0 6px rgba(0,0,0,0.15)
Card / Modal:  0 8px 40px rgba(0,0,0,0.12)
Pill Button:   0 34px 10px rgba(96,134,195,0),
               0 22px 9px rgba(96,134,195,0.01),
               0 12px 7px rgba(96,134,195,0.05),
               0 6px 6px rgba(165,200,255,0.09)
Toggle Knob:   0 2px 4px rgba(0,0,0,0.12),
               0 4px 5px rgba(0,0,0,0.08),
               0 1px 10px rgba(0,0,0,0.05)
Keyboard Key:  0 0.962px 0 rgba(0,0,0,0.30)
Close Button:  0 12px 24px rgba(34,61,74,0.08)
Close Button Inset: inset 0 0 0 1px rgba(255,255,255,0.58)
Only black or primary-blue-tinted shadows are permitted. No colorful drop shadows.
Mobile elevation rule
	•	Grouped content cards, information cards, and in-card detail panels use a flat surface by default: solid system background color and no shadow.
	•	Reserve Card / Modal shadow for floating layers such as dialogs, drawers, anchored popovers, and FABs.
	•	Do not add a shadow merely to separate two nested card levels; use the defined surface colors and radius hierarchy instead.
4.6 Z-Index Stack

Base:       0
Sticky:    10   ← PC top menu bar
Dropdown: 100   ← context menus, select dropdowns
Drawer:   200   ← bottom / side drawers
Overlay:  300   ← modal backdrop
Modal:    400   ← dialogs, modals
CloseBtn: 450   ← floating close button above modal
Toast:    500   ← always on top
4.7 Motion
Durations

Instant:    0ms    ← immediate state switches
Fast:       150ms  ← button press feedback
Normal:     250ms  ← color/border transitions
Slow:       350ms  ← modal/drawer appear
Entrance:   400ms  ← page-level transitions
Easing

Out:        cubic-bezier(0, 0, 0.2, 1)        ← elements appearing
InOut:      cubic-bezier(0.4, 0, 0.2, 1)      ← elements moving
Spring:     cubic-bezier(0.22, 1, 0.36, 1)    ← position-safe drawer snap; never overshoots
Semantic Transitions

Standard Button:  background-color + opacity + transform, 150ms ease-out
Icon-only Button: opacity + color + transform, 150ms Out; never add a pressed/open background block
Input:            border-color + background-color, 250ms ease-out
Modal:            opacity + translateY, 350ms ease-out
Drawer:           translateY/X, 350ms position-safe spring; no positional overshoot
Toast:            opacity + translateY, 250ms ease-out
Blur / Glass Values

Page background:    100px
PC window:          42.5px
PC glass layer:     transparent frosted-glass effect, angle -45°, intensity 67%, depth 8%
Mobile drawer:      42.5px
Full-screen overlay: 10px
Close button:       50px
Decorative orb:     150px

5. Component Rules
5.1 Button
Variants and When to Use
	•	Primary: Single main action per page. Full-width on mobile (319px × 50px).
	•	Secondary: Paired with Primary. Ghost border, subtle background.
	•	Danger: Irreversible actions only. Red #E11D48. Never for navigation.
	•	Soft Danger: Secondary destructive action inside a card or detail panel. Red text on rgba(225,29,72,0.10); never replaces the filled Danger action in a final confirmation.
	•	Ghost / Pill: On dark/blurred backgrounds (drawers, overlays). Fully rounded, frosted glass.
	•	Link: Text-only. Blue for active links, rgba(3,17,33,0.40) for passive ("skip", "previous").
	•	Disabled: Same layout as Primary but background: rgba(3,17,33,0.15). Always visible, never hidden.
Button Copy Rules
	•	Use verbs: "立即更新", "重新扫描", "开始使用" — not nouns
	•	Mobile: 14–16px Medium. PC: 14px Medium.
	•	Button label can change dynamically based on form completion state (e.g. "下一步" → "确定重置密码")
State Machine

Empty form    → Disabled (rgba(3,17,33,0.15), white text)
Valid form    → Active (#031121, white text)
Submitting    → Toast appears, button stays unchanged
Success       → Navigate to Result page
Error         → Toast appears, form stays editable
Icon-only Button
	•	Definition: a button whose visible content is only an icon, including navigation icons, toolbar actions, overflow triggers, and floating icon actions.
	•	Mobile touch target must remain at least 44×44px. Keep the icon centered inside the hit area.
	•	Pressed feedback may combine opacity: 0.60 with a subtle scale(0.96), translation, or semantic icon-color change, using 150ms Out.
	•	Transform feedback must not change the component's layout footprint or reduce its defined touch target.
	•	An icon-only trigger may use opacity, transform, or a semantic icon-color change as a persistent open-state cue while its linked menu is visible.
	•	Never add a square, circular, or rounded background block that appears only for pressed/open feedback.
	•	A filled icon-only control such as a FAB keeps its default fill and may use opacity or transform feedback; its existing semantic fill is not considered an added feedback background.
	•	Text-and-icon menu rows, tabs, option rows, toggles, and content cards are not icon-only buttons and retain their own component state rules.
Soft Danger Button (Mobile)

Height:      ≥ 44px
Width:       fill the containing detail panel when it is the panel's only action
Radius:      12px
Text:        #E11D48, 13px Medium
Background:  rgba(225,29,72,0.10)
Pressed:     opacity 0.56 + scale(0.96), 150ms Out
Floating Action Button (Mobile)

Size:        56×56px
Position:    right 28px, bottom 28px (above the home-indicator safe area)
Radius:      full
Background:  #031121
Icon:        24px, #FFFFFF
Shadow:      Card / Modal
Pressed:     opacity 0.60 + scale(0.96), 150ms Out
Use a FAB only for the single persistent create/add action of the current view. Its defined dark fill remains visible in every state; do not introduce a second pressed-state background.

5.2 Input
Structure: left icon (x=40px) + text area (from x=70px) + optional right element
Right-side elements (max 1 icon + 1 text, never more):
	•	Eye icon (password): #C4C4C4
	•	Clear icon: #BFC3C6
	•	Text link ("历史连接", "获取验证码"): #3D86F8
	•	Countdown ("32s"): rgba(3,17,33,0.40)
States

Default:  border rgba(191,195,198,0.6), placeholder #BFC3C6
Focused:  border rgba(3,17,33,0.7), text #031121
Filled:   border rgba(191,195,198,0.6), text #031121
Error:    border UNCHANGED — show red text BELOW the field, never inside
Disabled: reduced opacity, pointer-events none
Error text format: * [actionable description] Example: * 密码至少要6位数 Font: 10px Regular, color #E11D48, left-aligned, below the field.
Passwords: render as ••••••••, letter-spacing 3.6px.
Drawer Input (Mobile)

Height:      54px
Radius:      14px
Padding:     0 14px
Text:        14px Regular, #031121
Border:      rgba(191,195,198,0.60)
Background:  rgba(233,241,247,0.20)
Focus:       border rgba(3,17,33,0.70), transparent background
This is the contained in-flow field variant for a bottom drawer. It does not replace the standard 50px page-form input.

5.3 Select
Platform behavior — always design separately
	•	Mobile (default): Opens a bottom Drawer containing a scrollable option list. This is the correct pattern for the vast majority of mobile selects.
	•	Mobile (rare exception): Navigates to a full-screen selection page (see §6.7) instead of a drawer. Use this only when the option is high-stakes or you deliberately want to discourage casual changes (e.g. 协议版本 / 最低协议版本). Never use full-page navigation for ordinary selects.
	•	PC: Opens an inline Dropdown anchored directly below the trigger.
	•	Trigger visual rule: A select trigger must read as an input field, not as an action button. The chevron already communicates expandability; do not add a filled button background or strong action styling.
Trigger appearance

Height: Mobile 34–50px / PC 36–44px, matched to surrounding form density
Radius: 8px for compact row selects, 12px for full form selects
Border: rgba(191,195,198,0.60)
Background: rgba(237,245,251,0.20)
Text: #031121, Regular or Medium only when matching adjacent row labels
Padding: left 10–12px, right 10–32px depending on chevron layout
Arrow: always visible, muted (#414A54 or rgba(3,17,33,0.40)), right aligned
Do not use: primary-blue filled backgrounds, pill styling, link-button padding, or action-button emphasis
Compact row select
	•	Use for settings rows where the label is left-aligned and the selected value is right-aligned.
	•	Keep the trigger visually quiet: input-like border, subtle fill, right chevron, no blue background.
	•	The selected value may be right-aligned when the trigger sits on the right side of a row.
	•	Selected value color: neutral #031121 — never blue. The right chevron alone signals that the row is navigable/editable. Blue is reserved for action signals only (§9.1); do not tint the value to imply interactivity.
PC trigger / native select fallback

Height: 36px minimum
Radius: 8px
Border: rgba(191,195,198,0.60)
Background: rgba(237,245,251,0.20)
Text: #031121, 14px Regular
Padding: left 10px, right 32px
Arrow: custom 12px down chevron, #414A54, positioned right 10px center
Native arrow: disabled with appearance: none
Focus: border rgba(3,17,33,0.70), arrow unchanged
Disabled: keep custom arrow, cursor not-allowed
Option item height: 63px (Mobile drawer / full-page) / 36px (PC dropdown)
Option highlight block (both platforms) Every standard text option list (drawer, PC dropdown, or full-page selection) shows a light gray-blue highlight block behind the row:

Highlight block: bg #E9F1F7, rounded to match the row
Shown when:      hover (PC only) · selected · pressed/active (tap or click)
Selected indicator — platform-specific (design separately)

PC:      row highlight block bg #E9F1F7 + text #3D86F8 + right-side blue checkmark (plain check)
Mobile:  text #3D86F8 + right-side filled blue circle with white checkmark (#3D86F8 fill, white ✓)
Option text color

PC dropdown:  unselected options #031121 (black), ONLY the selected option is #3D86F8 blue
Mobile:       unselected options #031121 (black), ONLY the selected option is #3D86F8 blue
Unselected state: transparent bg, text #031121, no indicator
Card-based media selection (Mobile visual variant)
Use this presentation when each option contains a device/media image plus multiple lines of metadata. It changes only the option-row visual treatment; the existing drawer/full-page selection decision remains unchanged.

Option height:       82–96px minimum, based on metadata density
Radius:              18px
Padding:             12–16px
Background:          #F2F9FE in default, pressed, and selected states
Media image:         46px
Title:               14px Medium, #031121
Metadata:            12px Regular, rgba(3,17,33,0.40)
Indicator column:    44px touch-safe area
Selected indicator:  24px filled #3D86F8 circle + white check
	•	Selection feedback comes only from the right-side indicator; do not add a selected or pressed highlight block to the card.
	•	Keep unselected title and metadata colors unchanged when another card is selected.
	•	This is the scoped exception to the standard option highlight block above.

5.4 Tabs
	•	Only one style: underline tabs. No pill tabs, no bordered tabs.
	•	Maximum 2 tabs per group.
	•	Active: text #031121 Medium, 2px × 32px black underline below text
	•	Inactive: text #BFC3C6 Regular, no underline
	•	Underline is always black (#031121), never blue.
	•	Mobile touch target: 44px high, with the label centered vertically.
	•	A top-level mobile tab bar may remain sticky and must use the same surface color as the page/navigation area beneath it.
	•	Pressed feedback must not add a background block or expose the browser/system tap highlight.

5.5 Card
Card types are purpose-specific — never mix their rules:
PC Settings Row

Container: 573px wide, 2 rows (header 45px + content 45px)
Header: top-radius 8px, tinted bg (blue or green, 0.03 opacity)
Content: bottom-radius 12px, same tint
Mobile Device Card

Size: 339px × 101px, radius 18px, bg #F2F9FE
Left: device image (~60px)
Right: name (18px Medium) + IP|user (12px, #414A54) + status (12px, color-coded)
Swipe right: reveal 54px red delete zone (rgba(225,29,72,0.10))
Mobile Update Card

Size: 319px wide, radius 24px, bg #F2F9FE
Structure: decorative image top + title + divider + scrollable content
Buttons live OUTSIDE the card
Mobile Resource Status Card

Width:             fill the 319px mobile content column
Radius:            24px
Background:        #F2F9FE
Shadow:            none
Gap between cards: 16px
Overview padding:  16px 14px 14px
Asset tile:        58×58px, radius 16px
Title:             15px Medium, #031121
Status badge:      24px high, 9px horizontal padding, 12px Medium
Progress:          7px high, pill radius
Capacity metadata: 12px Regular, rgba(3,17,33,0.70)
Trailing chevron:  muted, centered in a touch-safe area
	•	The complete card may act as the navigation target for its resource detail page.
	•	Keep pressed feedback transparent; do not tint the whole card merely to acknowledge a tap.
Nested Detail Panel

Margin:      0 10px 10px
Padding:     12px
Radius:      16px
Background:  #E9F1F7
Shadow:      none
Use this panel for secondary information that remains visually and semantically inside the outer 24px resource card.
Compact Facts Row

Layout:            single horizontal line, content-width items
Label/value text:  12px Regular
Label:             rgba(3,17,33,0.40)
Value:             rgba(3,17,33,0.70)
Separator:         1×10px, rgba(3,17,33,0.18)
Separator spacing: 12px on each side
Use full-width punctuation (：) between each label and value. Do not render facts as separate status cards or badges.

5.6 Modal
§5.6b Universal Overlay Backdrop (PC + Mobile) — one treatment per platform
Every overlay in the product — Confirm Dialog, Alert Dialog, Update Modal, Bottom Drawer, Side Drawer, full-screen modal — must use the backdrop treatment defined for its platform:

Mobile: background rgba(0,0,0,0.15) + backdrop-filter blur(12px)
PC:     background rgba(0,0,0,0.15), no backdrop blur
	•	The mobile backdrop covers the full mobile viewport.
	•	The PC backdrop is exactly the same size as the current parent app window. It must never dim or block the desktop outside that window.
	•	Never use a desaturate/变灰 wash or introduce per-component backdrop variations.
Dialog dismissal and completion
Interaction
Standard dialog
Danger / unsaved dialog
Close (×) / Cancel button
Allowed
Allowed
Click backdrop
Disabled by default
Disabled
Press Esc
No response
No response
Submit succeeds
Close automatically
Close automatically, then show the existing centered Toast feedback
	•	Dialogs do not register Esc as a default dismissal action. Users dismiss a dialog only by clicking an available Close (×) or Cancel control.
	•	If a business flow must respond to Esc, that behavior must be declared explicitly in the relevant business module; it must not be inherited from the design system default.
	•	Backdrop-click dismissal is never a default behavior. A product requirement must explicitly declare the exception before it can be implemented.
	•	After a successful standard submission, close the dialog automatically. If the result needs passive confirmation, use the existing centered Toast pattern in §5.8; danger or unsaved flows always provide that Toast feedback after closing.
	•	Dialog maximum width and height are each 90% of the available container. On PC, calculate both limits from the current parent app window; on mobile, calculate them from the viewport.
Mobile Overlay Decision Guide — pick the right container first
User moment
Container
Why
Binary yes/no decision, no input needed (delete? go complete?)
Confirm Dialog (强提醒 confirm)
Forces a deliberate choice; a drawer would feel too soft for a decision
Part of the current step: small input, brief note, or few settings
Bottom Drawer
Stays in the flow; a full page would break the operation path, a dialog can't hold input
Passive feedback / status result (created, copied, updated)
Toast (centered)
No decision or input; just confirm the outcome and vanish
Confirm Dialog (Mobile) — 强提醒 confirm
	•	When: a binary yes/no choice that the user must make and that requires no text input. Use this — not a drawer, not a full page — for pure decision moments.
	•	System reset / factory reset / erase-device actions always use a Danger Confirm Dialog. Never demote these high-impact decisions to a Drawer because the warning copy is long; condense the final warning to the essential consequence and required preparation.
	•	Centered card, width screen − 56px (319px at the reference canvas), padding 24px 20px 20px, light bg (#E9F1F7 / #F2F9FE family), radius 24px
	•	Backdrop: the mobile overlay — rgba(0,0,0,0.15) + blur(12px) (see §5.6b).
	•	Title: 18px Medium, #031121, centered (e.g. 确认删除, 完善账号信息)
	•	Description: 14px Regular, rgba(3,17,33,0.70), centered, ≤ 2 lines (e.g. 确定要删除该共享目录吗?)
	•	Two 50px-high buttons side by side, equal width, 12px gap, radius 12px. Fixed order — never swap:
	•	Left = Cancel (取消): secondary, light gray fill, #031121 text
	•	Right = confirm action:
	•	Danger action → filled #E11D48, white text (e.g. 删除)
	•	Neutral / forward action → filled #031121, white text (e.g. 去完善)
	•	No close (×) button — the two buttons are the only exits.
Update Modal (Mobile)
	•	Large frosted card (319px, radius 24px) + full-screen mobile backdrop (rgba(0,0,0,0.15) + blur(12px))
	•	Floating close button (28px circle, frosted glass) at card bottom center
Confirm Dialog (PC)
	•	343px wide, radius 28px, shadow 0 8px 40px rgba(0,0,0,0.12)
	•	Backdrop is rgba(0,0,0,0.15) with no blur, scoped to the current parent PC window only; never dim or block the desktop outside the window
	•	Button row: Danger action + Cancel action, each 72px wide, radius 8px
Alert Dialog (Mobile)
	•	Light alert (245px, single button): 14px Semibold text button, divider line
	•	Force alert (271px, red title, full-width button): no close/skip button

5.7 Drawer
When to use (Mobile): the interaction is part of the current business step — a small amount of input, a brief explanation, or a few settings — where a full-page jump would be too heavy and break the operation path, and where a Confirm Dialog (no input) does not fit. Do not use a drawer for pure yes/no decisions (use a Confirm Dialog, §5.6).
Mobile Bottom Drawer

Height:         content-driven for short content; 449–500px for long/scrollable content
Maximum height: screen height − 24px
Surface:        #EAF2F8 + optional backdrop-blur(42.5px), top-radius 24px
Padding:        10px 20px calc(24px + env(safe-area-inset-bottom))
Backdrop:       the mobile overlay — rgba(0,0,0,0.15) + blur(12px) (see §5.6b)
Drag handle:    32×4px, rgba(3,17,33,0.10), centered, top-offset 10px
Title:          18px Medium, #031121, centered
Header/footer:  no divider lines; preserve separation with spacing
Buttons:        50px high, radius 12px, 12px gap
Animation:      translateY, 350ms position-safe spring `cubic-bezier(0.22, 1, 0.36, 1)`
	•	The drawer surface and its title/action areas must use one continuous background color.
	•	Keep the drawer anchored at bottom: 0 throughout the transition.
	•	The drawer's top edge must approach but never cross its final resting position. Do not use a translate easing with a Y control point above 1 (for example, cubic-bezier(0.34, 1.56, 0.64, 1)), because it produces positional overshoot.
	•	During open and close transitions, the drawer surface must continuously cover the bottom edge of the viewport; the backdrop or underlying page must never flash through beneath it.
	•	Pin the action row to the drawer bottom when the body scrolls.
	•	A long-form text body keeps 30px bottom padding after its final line.
Input Drawer content pattern (e.g. 新建文件夹)

Title:     18px Medium, #031121, centered (e.g. 新建文件夹)
Input:     single 54px field, radius 14px, clear (×) icon on the right, placeholder per §8.5
Error:     red 10px text BELOW the input, border unchanged (§5.2) — e.g. 同名文件夹已存在，请修改文件名称
Buttons:   two side by side, equal width, 50px high, radius 12px, 12px gap
             Left  = 取消 (secondary, light gray fill, #031121 text)
             Right = 确定 (primary, filled #031121, white text)
Keyboard:  drawer sits above the system keyboard; content stays visible
PC Side Drawer (Language)

Width:    293px
BG:       backdrop-blur(42.5px) + #F2F9FE, left-radius 24px
Animation: translateX, 350ms spring easing

5.8 Toast

BG:          rgba(0,0,0,0.60)
Text:        #FFFFFF, 14px Regular, line-height 22px
Padding:     20px horizontal, 12px vertical
Radius:      12px
Position:    centered (horizontal + vertical)
Width:       hug content (auto-fit to text) for short copy; cap at screen width − 2×28px margin
Max lines:   2
When to use (Mobile): passive feedback or a status result that needs no decision and no input — confirming an outcome (e.g. 新建成功, 账号已更新, 已复制到剪切板) or reporting a network/API state. Always pops at the center of the screen (horizontal + vertical). If the user must choose or act, use a Confirm Dialog (§5.6) instead.
Loading Toast: 18px spinning icon (12 radial lines, opacity gradient 0.2→1, 1s linear infinite) + text, gap 8px
Rules:
	•	One toast at a time. New toast replaces previous.
	•	Auto-dismiss after 2–3s (permanent for loading state)
	•	No action buttons inside Toast.

5.9 Tooltip / Popover
Tooltip: Dark background (#031121), white text, 12px Regular, radius 6px, padding 4px 8px, max 2 lines, hover-only (no mobile hover)
Popover (for link guides, connection instructions): Card style (#F2F9FE, radius 12px, shadow modal), contains structured content (steps, images, links)

5.10 Dropdown (Context Menu)
Platform behavior — design separately
	•	PC: anchored dropdown positioned below / next to the trigger.
	•	Mobile: an anchored floating popover card positioned near the trigger point (e.g. the ... kebab menu). This is the primary sanctioned exception to "mobile overlays are drawers/modals" (§5.7) — small contextual action menus appear as anchored popovers, not bottom drawers. The drawer-vs-popover choice is judgment-based per context: default to an anchored popover for compact contextual action menus, and reserve drawers/full modals for larger or more disruptive choices.
PC context menu

Min width:    84px
Width:        hug the longest option content; expand automatically
Max width:    parent app window width − 24px safe margin
Row height:   28px
BG:           #F2F9FE, radius 8px
Icon:         12px, left margin 12px
Text:         10px Regular, left margin 6px from icon

Normal action:  #031121 text + icon
Danger action:  #E11D48 text + #E40303 icon
Selected item:  bg #E9F1F7, blue text
Mobile anchored popover menu

Min width:    120px
Width:        hug the longest option content; expand automatically
Max width:    screen width − 16px safe margin
Padding:      4px
BG:           #F2F9FE, radius 12px, shadow Card/Modal (0 8px 40px rgba(0,0,0,0.12))
Row:          44px high, radius 8px, 12px horizontal padding
Icon:         16px
Text:         14px Regular, icon-to-text gap 8px
Position:     anchored to the trigger (kebab `...`), pointing toward it
Pressed:      opacity 0.60 + scale(0.98), transparent background

Normal action:   #031121 text + icon (e.g. "SMB设置", "编辑账号")
Additive action: #3D86F8 blue text + blue icon for the primary/create action (e.g. "添加账号")
Danger action:   #E11D48 text + #E40303 icon (e.g. "删除账号")
	•	The listed platform width is a minimum width, not a fixed width. Do not set a business-specific fixed width on an individual menu.
	•	Keep option labels on one line while the popover remains below its maximum width. Only wrap labels after the maximum boundary is reached.
	•	The popover must escape the clipping boundary of its source card/list. Reposition above the trigger when the lower viewport space is insufficient.
	•	Do not add a pressed background block to mobile context-menu rows.

5.11 Navigation
PC Sidebar

Width:       216px
Item height: 44px, padding px-16 py-12, radius 12px, gap 6px
Active:      bg rgba(242,249,254,0.50), border 0.6px #FFF, text #3D86F8 Semibold
Inactive:    transparent bg, text #031121 Regular
Window controls: traffic-light buttons sit at the top-left of the sidebar area
Mobile Top Nav (Secondary screen with back)

Total height:       60px (below 44px status bar)
Left/right slots:   44px minimum touch targets
Back icon:          28px, color #031121
Right action icons: 20px, right aligned
Title:              16px Regular, #031121, positioned at the screen's geometric center
Surface:            match the page background
The title stays centered independently of the width or number of left/right actions. Transparent icon actions use opacity/transform feedback only (§5.1).
Mobile Startup Bottom Zone

Start Y:     716px
Height:      108px, top-radius 24px
BG:          backdrop-blur(42.5px) + rgba(242,249,254,0.05)
Handle:      32×4px, rgba(236,240,243,0.30), top centered
Primary CTA: 16px Medium, white, uppercase

5.12 Mobile Toggle and Acknowledgement Controls
Toggle

Touch target:  48×44px
Visual track:  48×28px, vertically centered, full radius
Knob:          22×22px, 3px inset, #FFFFFF
Off track:     rgba(3,17,33,0.15)
On track:      #3D86F8
Pressed:       opacity 0.72
The enlarged touch target must not increase the visible track height.
Circular acknowledgement / selection control

Size:       24×24px
Default:    transparent fill, 1.5px rgba(3,17,33,0.24) border
Selected:   #3D86F8 fill + white check
Pressed:    opacity 0.70 + scale(0.92)
Use this control for a mobile risk acknowledgement or the selected indicator in a card-based media option. It does not replace the default compact form checkbox.

6. Layout Rules
6.1 Platform Split — Always Design Separately
Dimension
PC
Mobile
Canvas
1920×1080px
375×812px
Layout
Two-column (sidebar + content)
Single-column vertical
Base padding
24px
28px
Touch target
Not applicable
≥ 44px minimum
Overlay style
Center Dialog
Bottom Drawer or Full Modal
Navigation
Fixed left sidebar
Top bar + page transitions
Background
Frosted glass window
Gradient mask over blurred wallpaper
Never force one responsive design to cover both platforms. Each must be designed independently.
6.2 Mobile Page Anatomy

[Status Bar]           44px  — system UI, not designed
[Navigation Area]      60px  — title or back + title
[Content Area]         auto  — scrollable, 28px horizontal padding
[Button Zone]          50px+ — sticky bottom, above home indicator
[Home Indicator Zone]  34px  — system UI, not designed
6.3 PC Window Anatomy

[Root Window]             — transparent container, border radius 26px, shadow modal, overflow hidden
  ├── [Root Glass Layer]   — absolute full-window layer behind all content; bg #F2F9FE at 70% opacity + transparent frosted-glass effect angle -45°, intensity 67%, depth 8%; include both backdrop-filter and -webkit-backdrop-filter
  ├── [Sidebar]           216px fixed left column, no top full-width menu bar, no independent background or divider
  │     └── Traffic Lights — top-left window controls
  └── [Right Content Area] scrollable, 24px padding, z-index above Root Glass Layer, bg #FFFFFF at 48% opacity, transparent frosted-glass effect angle -45°, intensity 67%, depth 8%; include both backdrop-filter and -webkit-backdrop-filter
        ├── Corner Radius  — top-left and bottom-left corners match the sidebar/window radius
        ├── Top Glow       — pseudo-element overlay, height 12% of window, linear-gradient #00A2F2 at 10% opacity → transparent
        ├── Page Title     — displayed at the top of the right content area
        ├── Content        — cards, tables, forms, settings rows; content must sit above all glass overlays
        ├── Soft Glass      — pseudo-element overlay, #FFFFFF at 12% opacity
        └── Bottom Glow    — pseudo-element overlay, height 12% of window, linear-gradient transparent → #00A2F2 at 10% opacity
6.4 Background System (Mobile)
The default mobile page uses the following three-layer background stack:

Layer 1 (bottom): Blurred wallpaper image (blur: 100px)
Layer 2 (middle): Gradient mask (transparent top → rgba(242,249,254,0.95) bottom, covering ~87% height)
Layer 3 (top):    Page content
Management / utility page surface variant

Use for:     dense management tools with a persistent top nav, tabs, grouped cards, or long settings lists
Surface:     solid #EAF2F8
Continuity:  status bar, top nav, sticky tabs, page content, and bottom drawer title/action areas share the same surface
Cards:       #F2F9FE or #E9F1F7, so hierarchy remains visible without page decoration
This is a scoped mobile visual variant, not a new generic background color. Do not use a pure white mobile page background.
6.5 Form Layout
	•	Always single-column, vertical stack. No side-by-side inputs. No label-left / input-right grids.
	•	Top-to-bottom order: page title → subtitle → input group → helper text → primary button → secondary link
	•	Keyboard-aware: when system keyboard appears, the form should scroll so the focused input remains visible
6.6 Result Pages
All success/completion screens follow one fixed pattern:

Background:   #EAF2F8
Vertical:     center-aligned
Icon:         78×78px outlined badge with checkmark (stroke: #031121, 2.6px)
Label:        16px Regular, #031121, centered, below icon
Primary CTA:  50px, #031121, 319px wide, radius 12px, bottom-anchored
6.7 List Pages (Mobile)
Related mobile list patterns share the same grouped-card container. PC uses settings rows inside the glass content area instead (§5.5); these patterns are mobile-only.
Grouped List / Menu Enumeration Page (e.g. 局域网共享 → SMB / FTP / WebDAV / NFS / DLNA)

Background:   three-layer stack (§6.4), list-page tint #E1EAF1 base
Group card:   single rounded card, radius 24px, bg #F2F9FE, 28px horizontal page margin
Row:          label left (#031121, 16px Regular) + right chevron (rgba(3,17,33,0.40))
Row height:   ≥ 56px (touch-safe)
Divider:      inset — aligned to the text left edge, NOT full-width; rgba(98,116,142,0.10)
Full-Screen Selection Page (rare — the §5.3 mobile exception, e.g. 最低协议版本)

Nav:          back + centered title = the setting name (16px Regular, #031121)
Group card:   same grouped-card style as above
Option row:   label #031121; selected row → text #3D86F8 + filled blue circle with white ✓
Highlight:    selected / pressed row shows the #E9F1F7 block (§5.3)
Divider:      inset between options
Two-Line Descriptive Enumeration

Background:    management / utility page surface variant (§6.4)
Group card:    radius 24px, bg #F2F9FE, no shadow
Row height:    ≥ 80px
Row padding:   14px 12px 14px 14px
Title:         14px Medium, #031121
Description:   12px Regular, rgba(3,17,33,0.70), line-height 1.5, margin-top 4px
Chevron:       18px inside a 24px trailing area, rgba(3,17,33,0.40)
Divider:       1px rgba(98,116,142,0.10), left and right inset 14px
The complete row is the touch target. Do not show a pressed background block for ordinary navigation rows.
Grouped Record List

Group card:       radius 24px, bg #F2F9FE, no shadow
Record height:    ≥ 120px
Record padding:   16px 8px 16px 14px
Layout:           content column + 44px trailing action area
Title:            14px Medium, #031121
Metadata:         12px Regular, rgba(3,17,33,0.70)
Source badge:     10px Medium, full radius
Divider:          1px rgba(98,116,142,0.10), left inset 14px
	•	Use this pattern for timestamped records with multiple metadata fields and one overflow action.
	•	The overflow popover must not be clipped by the group card or record row (§5.10).
Grouped Settings List with Toggle

Group card:    radius 24px, bg #F2F9FE, no shadow
Row height:    ≥ 104px
Row padding:   18px 14px
Title:         16px Medium, #031121
Description:   12px Regular, rgba(3,17,33,0.70), line-height 1.5
Control:       right-aligned 48×44px toggle touch target (§5.12)
Divider:       1px rgba(98,116,142,0.10), left inset 14px
Inline Operation State

Spinner:       18px, #3D86F8
Progress text: 12px Regular, #3D86F8
Stop action:   ≥ 44px touch target, rgba(3,17,33,0.70)
Gap:           4–8px
Replace the trailing chevron with this state only while the row's operation is running. Keep the row structure and surrounding dividers unchanged.

7. Interaction Rules
7.1 Button State Machine

Form incomplete → Disabled button (opacity bg, same layout)
Form complete   → Active button (#031121)
User submits    → Toast "操作中..." appears, button unchanged
Success         → Navigate to next screen
Failure         → Toast error message, form remains editable
7.2 Input State Machine

Initial   → gray border + placeholder
Focused   → darkened border + transparent fill
Has value → dark border reverts, text #031121
Error     → border UNCHANGED, red text appears BELOW field
7.3 Error Feedback Rules
Trigger
Method
Location
Duration
Field validation
Text below input
Inline
Until corrected
API / network error
Toast
Screen center
2–3s then dismiss
Irreversible failure
Dialog
Center modal
Until user acts
System-level block
Force Alert Dialog
Center, no close
Until user acts
Never use red borders to signal errors. Error color only appears in text, never in structural chrome.
7.4 Loading States
Context
Visual
API request
Toast with spinning icon + text ("连接中...", "注册中...")
File download
Progress bar (4px, #031121 fill, 283px wide) + percentage text
Device scan
48px spinning icon + "扫描中" text, centered in drawer
Page load
No skeleton. Data renders directly when ready.
7.5 Drawer Behavior

Open:  translateY(100%) → translateY(0), 350ms position-safe spring
Close: translateY(0) → translateY(100%), 350ms position-safe spring
       OR tap outside the drawer area
Always include a drag handle. Use cubic-bezier(0.22, 1, 0.36, 1) for Drawer motion. The Drawer must not overshoot past translateY(0) or expose the underlying layer at the viewport bottom during motion.
7.6 Card Swipe (Mobile)

Swipe left:  card slides to reveal 54px delete zone (right side)
Tap delete:  Confirm Dialog appears
Tap outside: card slides back, 350ms spring
7.7 Toast Lifecycle

Enter: opacity 0→1 + translateY(8→0), 250ms ease-out
Stay:  2–3s for text toasts; indefinite for loading toasts
Exit:  opacity 1→0, 250ms ease-out
New toast replaces existing toast immediately (no queue).
7.8 Countdown (Verification Code)

State before send:  "获取验证码" (blue link)
State after send:   "Xs" countdown (rgba(3,17,33,0.40), non-clickable)
State after 0s:     Reverts to "重新发送" (blue link)
7.9 Multi-Step Form Navigation

Backward: "上一步" (text link, rgba(3,17,33,0.40))
Skip:     "跳过" (text link, rgba(3,17,33,0.40))
Forward:  Primary Button (label changes per step)
The button label must reflect the action, not the step number:
	•	"下一步" for intermediate steps
	•	"提交注册" / "确定重置密码" for final confirmation step

8. Content Rules
8.1 Copy Tone
	•	Concise: No padding words. Every word must earn its place.
	•	Action-first: Verbs before nouns. "立即更新" not "版本更新".
	•	Human: No jargon to end-users. Error messages speak in plain language.
	•	Specific: Numbers, paths, device names are always shown verbatim when available.
8.2 Error Message Formula
Every error message must follow this structure:

[What happened] + [What to do]
✅ Good
❌ Bad
"密码至少要6位数"
"密码格式错误"
"请检查设备地址是否正确"
"连接失败"
"请确保设备已接通电源并连接到同一局域网中"
"未找到设备"
"请检查网络连接是否正常"
"更新中断"
8.3 Status Labels
Use exactly these terms and colors:
Status
Chinese
Color
LAN connected
内网在线
#3D86F8
WAN connected
公网在线
#17A857
Offline
离线
rgba(65,74,84,0.40)
Initializing
初始化
#031121
Scanning
扫描中
#031121
8.4 Button Label Rules
	•	Use uppercase sparingly (only for CTA copy like "发现新设备")
	•	Use sentence case for all other buttons ("立即更新", "开始使用")
	•	Never use all-caps for body text or error messages
	•	Device names and file paths: always display verbatim, no truncation unless in a table cell
8.5 Placeholder Text
Format: 请输入[field name] Examples: 请输入IP地址或LinkID, 请输入邮箱或者手机号码 Never use example values as placeholders (e.g. "user@example.com").
8.6 Disclaimer / Footnote Copy
Prefix: * (asterisk + space) Position: Below the relevant field or button Size: 10px Regular Color: rgba(3,17,33,0.40) (neutral) or #E11D48 (warning)

9. Forbidden Patterns
The following design choices must never appear in any MinisCloud OS UI. If you are about to produce any of these, stop and find the correct approach.
9.1 Color Violations
❌ Forbidden
✅ Correct approach
Fourth semantic color (orange, purple, yellow for UI states)
Use gray/muted text for non-critical states
Gradient backgrounds on content cards
Use solid #F2F9FE or #EAF2F8
Red border on error fields
Red text below the field, border unchanged
Pure white #FFFFFF as mobile page background
Use #EAF2F8
Black text on gradient/dark backgrounds
Use #FFFFFF
Blue as a decorative/emphasis color (non-interactive)
Blue = action signal only
Green/red for anything other than success/danger
Use neutral text color
9.2 Typography Violations
❌ Forbidden
✅ Correct approach
Any font other than Afacad Flux (brand only) and PingFang SC
Use PingFang SC
Font size below 10px
10px minimum
Bold weight (700+)
Use Semibold (600) maximum
Large font + Regular weight to fake a heading
Use Medium weight
Small font + Medium weight to fake emphasis in footnotes
Use Regular
Colored text for decoration (not semantic)
Black or gray text only
9.3 Component Violations
❌ Forbidden
✅ Correct approach
More than 1 Primary button on a page
Single primary action
Inner component radius > outer container radius
Match or decrease radius inward
Skeleton screens
Direct render when data arrives
Toast with action buttons
Use Modal/Dialog for actionable messages
Multiple toasts at once
Replace current toast
Toast visible for > 5 seconds
Use Dialog for persistent messages
Force alert dialog with close/skip button
Remove escape for truly forced actions
Context menu with > 5 items
Use a full Modal/Sheet
Tabs with > 3 items
Redesign as a separate navigation or select
Side-by-side input fields
Single-column vertical form only
A transparent icon-only button gains a square, circular, or rounded background block when pressed/open
Keep the background transparent; use opacity, transform, or semantic icon-color feedback instead
Colorful icon as decoration
Icons serve function only
Emoji in UI copy
Plain text only
9.4 Layout Violations
❌ Forbidden
✅ Correct approach
One responsive layout for both PC and Mobile
Design each platform separately
Touching screen edges without 28px margin (mobile)
Always respect page padding
More than 3 overlay layers stacked
Restructure user flow
Gradient backgrounds on form sections
Solid #F2F9FE
Multi-column forms on mobile
Single-column always
Frosted glass on regular content cards
Glass only on system/floating elements
9.5 Animation Violations
❌ Forbidden
✅ Correct approach
Decorative entrance animations
Only spatial/feedback animations
Number roll-up effects (achievement-style)
Static text display
Particle effects, ripples, confetti
Not part of this design language
Animations > 500ms for UI transitions
Keep under 400ms
Custom easing for modal/drawer (non-spring)
Use defined spring easing
9.6 Content Violations
❌ Forbidden
✅ Correct approach
Error message without actionable instruction
Always tell the user what to do
Placeholder = example data (user@example.com)
Use descriptive placeholder text
More than 4 steps in a user flow without justification
Simplify or redesign
Jargon terms in user-facing copy
Plain language
Empty state with no recovery action
Always provide a retry/next-step button

10. Review Checklist
Before finalizing any design output, verify every item in this list. A design is not complete until all boxes can be checked.
10.1 Color Check

□ No new colors introduced outside the defined token set
□ Blue (#3D86F8) is only used for interactive/active elements
□ Green is only used for success/online states
□ Red (#E11D48) is only used for danger/error/irreversible
□ Background is #EAF2F8 (mobile form) or #F2F9FE (card/modal), not pure white
□ Text on dark backgrounds uses #FFFFFF, not a gray
□ Error states use red text below field, not red border
10.2 Typography Check

□ Only Afacad Flux (brand title) and PingFang SC (everything else) are used
□ Font size is 10px minimum
□ Maximum weight used is Semibold (600)
□ Each text element uses the correct size × weight pairing from the type scale
□ Button labels are verbs, not nouns
□ Error messages follow the "[what happened] + [what to do]" formula
□ Placeholders use "请输入[field]" format, not example values
10.3 Layout Check

□ Platform is correctly identified (PC or Mobile) and designed for that platform only
□ Mobile: horizontal padding is 28px on both sides
□ Mobile: all touch targets are ≥ 44px
□ Mobile: single-column vertical form layout
□ PC: sidebar is 216px, content area is ~657px
□ No content touches screen edges without padding
□ Mobile background uses either the default three-layer stack or the scoped #EAF2F8 management / utility surface variant
□ Mobile top-nav title remains at the screen's geometric center when right-side actions are present
10.4 Component Check

□ Only one Primary button per page/view
□ Disabled button is visible (not hidden), with rgba(3,17,33,0.15) background
□ Soft Danger is red text on rgba(225,29,72,0.10) and never replaces the filled danger action in a final confirmation
□ Mobile FAB is 56×56px, right/bottom 28px, with one persistent semantic fill
□ Inner component radius ≤ outer container radius
□ Grouped mobile content cards are flat by default; shadows are reserved for floating layers
□ Mobile Resource Status Card uses radius 24px, 15px title, 7px progress bar, and no shadow
□ Nested Detail Panel uses 10px outer inset, 12px padding, radius 16px, and #E9F1F7
□ Compact Facts Row uses 12px text and a 1×10px separator with 12px spacing
□ Input errors appear as text below the field, border unchanged
□ Drawer Input uses 54px height, 14px radius, and 14px horizontal padding
□ Drawer includes a drag handle (32×4px strip)
□ Short drawers hug content; long drawers stay within 449–500px and keep 30px after the final long-form line
□ Drawer title/body/action areas share #EAF2F8 with no header/footer divider lines
□ Drawer motion uses the position-safe spring cubic-bezier(0.22, 1, 0.36, 1), never an overshooting Y control point
□ Drawer stays anchored at bottom: 0 and never exposes the underlying layer beneath it during motion
□ Toast contains no action buttons and pops at screen center (feedback/status only, no input/decision)
□ Correct mobile overlay chosen: Confirm Dialog (yes/no, no input) vs Drawer (in-flow input/settings) vs Toast (passive feedback)
□ Mobile Confirm Dialog has two equal-width buttons (取消 + action) and no close (×) button
□ Mobile Confirm Dialog is screen − 56px wide with 24/20/20px padding and 50px actions
□ Confirm Dialog action button color: danger = #E11D48, neutral/forward = #031121
□ Confirm Dialog button order fixed: 取消 left, action right (never swapped)
□ System reset / factory reset / erase-device actions use a Danger Confirm Dialog, never a Drawer
□ Every overlay uses its platform backdrop: Mobile = rgba(0,0,0,0.15) + blur(12px); PC = rgba(0,0,0,0.15), no blur
□ PC overlay backdrop matches the current parent app window bounds and never covers the desktop outside it
□ Dialogs do not respond to Esc by default; any Esc behavior is declared explicitly in the relevant business module
□ Backdrop click does not dismiss a dialog by default; Close (×) and Cancel remain click-only exits when provided
□ Successful danger / unsaved submissions close automatically and show the existing centered Toast feedback
□ Dialog maximum width and height are each 90% of the available container; PC limits use the parent app window
□ Toast width hugs short content and never exceeds screen width − 2×28px
□ Force alert dialog has no close/skip option
□ Select on mobile uses a Drawer by default; full-page selection only for rare high-stakes options; never native <select>
□ Select trigger looks like an input field, not a filled action button
□ Settings-row selected value is neutral #031121, not blue (chevron alone signals navigability)
□ Standard option lists show the #E9F1F7 highlight block on hover (PC) / selected / pressed
□ Card-based media options keep a stable #F2F9FE surface and use only the 24px blue-circle check for selection feedback
□ Selected indicator: PC = #E9F1F7 block + blue check; Mobile = filled blue circle + white check
□ In an option list, only the selected option text is blue; all others are #031121
□ Mobile context menus use an anchored popover; PC uses an anchored dropdown
□ Mobile context popovers use 120px width, 44px rows, escape list/card clipping, and add no pressed background block
□ PC native select fallback disables the browser arrow and uses the custom right 10px chevron
□ Tabs use underline style only, maximum 2 tabs, and a 44px mobile touch target
□ Context menu items: normal = #031121, danger = #E11D48
□ Two-line enumeration rows use 14px/12px type and dividers inset 14px from both sides
□ Grouped record/settings cards use radius 24px, flat surfaces, and touch-safe trailing controls
□ Mobile toggle uses a 48×44px touch target around a 48×28px visible track
□ Circular acknowledgement/selection controls are 24px with a blue fill and white check when selected
□ Transparent icon-only buttons add no pressed/open background block; opacity, transform, and semantic icon-color feedback remain permitted
10.5 State Check

□ All states defined: Default, Active, Disabled, Error, Empty, Loading
□ Loading state is a Toast (for actions) or centered spinner (for scans)
□ Empty state includes: icon, title, description, and a recovery action
□ Error state includes an actionable description, not just an error name
□ Offline device shows: muted text rgba(65,74,84,0.40), "离线" label
10.6 Interaction Check

□ Button label changes correctly across multi-step forms
□ Verification code countdown: "获取验证码" → "Xs" → "重新发送"
□ Swipe-to-delete on mobile device cards has confirm dialog before deletion
□ Drawer animations use the position-safe spring and show no positional overshoot or bottom-edge layer exposure
□ Toast auto-dismisses within 3s (or persists for loading state only)
□ Form validation does not block the UI before the user first attempts submit
10.7 Content Check

□ Every error message tells the user what to do next
□ No jargon in user-facing copy
□ Status labels use exact defined terms: 内网在线, 公网在线, 离线
□ Device names and file paths display verbatim without modification
□ Multi-step forms have "上一步" back navigation
□ Optional steps have "跳过" skip option
10.8 Forbidden Patterns Check

□ No fourth semantic color introduced
□ No gradient background on content cards
□ No decorative animations
□ No multi-column form layout
□ No frosted glass on regular content cards
□ No emoji in UI copy
□ No Toast with buttons inside
□ No skeleton loading screens
□ No responsive layout trying to cover both PC and Mobile

SKILL version: 1.0 Product: MinisCloud OS (PC Web + iOS Mobile) Applies to: All new UI design, component design, and feature design requests
