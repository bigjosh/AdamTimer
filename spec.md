# Timer App 

## Architecture

Single Page Web App. Designed to look simple and modern - especially on mobile. Uses cookies to store user state including an optional user-id and usage history.

Easily installable on homepage on mobile.  Uses js libs to keep phone from falling asleep after user presses start button. 

## UI

all page transitions are smoothed with 250ms fade-in and fade-out. 

### Start page

Start page is simple and modern and sparse, large simple font. White letters, back background. 

There a three fillable fields (all in minutes 0-999) for ...
* Lead in (default 0)
* Mediation (default 20)
* lead out (default 0)

All fields are persistent via cookies. 

There is a START button.

When the user presses start, we fade out the start page and enter the timer page.

### Timer page

The mediation page has a large count-down timers with mins:secs in the center of the screen. Simple font, white text over the prescribed background image. The image is cropped and scaled so that it always fills the screen at its fixed aspect ratio. 

There is always a "pause" button below the count down text that will pause the current timer. While paused, the text of the remaining time subtly heartbeats between 100% and 50% brightness. 

There is always an "end" below the pause button. Pressing end button stops the timer and then smoothly brings us to the completion page with a fade-out and fade-in.

If the timer reaches 0:00 then we fade out and go to the completion page. 

# lead-in screen

If there was a non-zero lead-in time set, then we fade-in `sand.jpg` background image and then the lead in counts down. At the end of the lead-in (0:00), we play `knock.mp3`, fade out the image, and move on to the meditation screen. 

# meditation screen

we fade-in `sea.jpg` and count down the meditation timeout. When the timer expires (0:00), we play `gong.mp3` and fade out.

# lead-out screen

If a lead out time is non-zero, we fade in `sand.jpg` and count down the lead-out time. At the end (0:00), we play `knock.mp3` and fade out. 

### Completion page

This shows the most recently completed meditaion stats with text "Log this session?" and yes and no buttons. Pressing either button returns to the start page.
