# Order alarm sound

Drop a short royalty-free chime here as **`order-alarm.mp3`** (1–3 seconds works well; the player loops it). Then in `services/sound.ts`, uncomment the two lines that load the asset and rebuild the dev client.

Until you do, the merchant Order Alerts will still:
- Vibrate the device via Haptics on each new paid order
- Show the red "🔔 New orders" banner
- Open the Acknowledge modal on tap

…but won't play sound.

Suggested sources for a free chime:
- https://freesound.org (CC0 search: "notification chime")
- https://pixabay.com/sound-effects/ (royalty-free)
- macOS / Windows built-in system sounds (Glass.aiff, Tink.aiff converted to mp3)
