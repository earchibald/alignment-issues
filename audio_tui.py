#!/usr/bin/env python3
import curses
import re
import os
import subprocess

SOUND_JS_PATH = 'game/js/ui/sound.js'

def parse_sounds():
    try:
        with open(SOUND_JS_PATH, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        return "", []

    sounds = []
    url_pattern = re.compile(r"const\s+([A-Z_]+)_SOUND_URL\s*=\s*new\s+URL\(\s*'([^']+)'")
    gain_pattern = re.compile(r"const\s+([A-Z_]+)_GAIN\s*=\s*([0-9.]+);")
    rate_pattern = re.compile(r"const\s+([A-Z_]+)_RATE\s*=\s*([0-9.]+);")

    urls = {m.group(1): m.group(2) for m in url_pattern.finditer(content)}
    gains = {m.group(1): float(m.group(2)) for m in gain_pattern.finditer(content)}
    rates = {m.group(1): float(m.group(2)) for m in rate_pattern.finditer(content)}
    
    for prefix in urls:
        if prefix in gains:
            sounds.append({
                'prefix': prefix,
                'path': os.path.normpath(os.path.join('game/js/ui', urls[prefix])),
                'gain': gains[prefix],
                'rate': rates.get(prefix, 1.0),
                'selected': False
            })
    return content, sounds

def save_sounds(content, sounds):
    for s in sounds:
        pattern = r"(const\s+" + s['prefix'] + r"_GAIN\s*=\s*)([0-9.]+);"
        content = re.sub(pattern, r"\g<1>" + str(round(s['gain'], 3)) + ";", content)
    with open(SOUND_JS_PATH, 'w') as f:
        f.write(content)

def get_sample_rate(path):
    try:
        out = subprocess.check_output(
            ['ffprobe', '-v', 'error', '-select_streams', 'a:0', 
             '-show_entries', 'stream=sample_rate', 
             '-of', 'default=noprint_wrappers=1:nokey=1', path]
        )
        return int(out.strip())
    except:
        return 44100

def play_sound(s, blocking=False):
    # Web Audio API's playbackRate is varispeed (changes both pitch and duration).
    # afplay's -r flag time-stretches without pitch-shifting by default, leaving
    # high-frequency bursts like microtick inaudible. So we use ffplay for rate changes.
    rate = s.get('rate', 1.0)
    if rate != 1.0:
        sr = get_sample_rate(s['path'])
        new_sr = int(sr * rate)
        cmd = ['ffplay', '-v', 'error', '-nodisp', '-autoexit', 
               '-af', f"asetrate=r={new_sr},volume={s['gain']}", s['path']]
    else:
        cmd = ['afplay', '-v', str(s['gain']), s['path']]
        
    if blocking:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def main(stdscr):
    curses.curs_set(0)
    content, sounds = parse_sounds()
    if not sounds:
        stdscr.addstr(0, 0, "No sounds found in game/js/ui/sound.js! Press any key to exit.")
        stdscr.getch()
        return

    current_row = 0
    message = ""

    while True:
        stdscr.clear()
        height, width = stdscr.getmaxyx()
        
        stdscr.addstr(0, 0, "=== Audio Level Tuning TUI ===", curses.A_BOLD)
        stdscr.addstr(1, 0, "Up/Down: Select | Left/Right: ±0.01 Gain | [/]: ±0.1 Gain")
        stdscr.addstr(2, 0, "Space: Select for sequence | Enter: Play one | P: Play sequence | S: Save | Q: Quit")
        
        for idx, s in enumerate(sounds):
            x = 2
            y = 4 + idx
            
            sel = "[x]" if s['selected'] else "[ ]"
            cursor = ">" if idx == current_row else " "
            
            display_name = s['prefix'].ljust(12)
            gain_str = f"{s['gain']:.3f}".rjust(6)
            
            line = f"{cursor} {sel} {display_name} Gain: {gain_str}  (Rate: {s['rate']})"
            
            if idx == current_row:
                stdscr.attron(curses.A_REVERSE)
                stdscr.addstr(y, x, line)
                stdscr.attroff(curses.A_REVERSE)
            else:
                stdscr.addstr(y, x, line)
                
        if message:
            stdscr.addstr(height - 1, 0, message, curses.A_STANDOUT)
            
        stdscr.refresh()
        message = "" # clear message for next tick
        
        key = stdscr.getch()
        
        if key == curses.KEY_UP:
            current_row = max(0, current_row - 1)
        elif key == curses.KEY_DOWN:
            current_row = min(len(sounds) - 1, current_row + 1)
        elif key == curses.KEY_LEFT:
            sounds[current_row]['gain'] = max(0.0, sounds[current_row]['gain'] - 0.01)
        elif key == curses.KEY_RIGHT:
            sounds[current_row]['gain'] = min(5.0, sounds[current_row]['gain'] + 0.01)
        elif key == ord('['):
            sounds[current_row]['gain'] = max(0.0, sounds[current_row]['gain'] - 0.1)
        elif key == ord(']'):
            sounds[current_row]['gain'] = min(5.0, sounds[current_row]['gain'] + 0.1)
        elif key == ord(' '):
            sounds[current_row]['selected'] = not sounds[current_row]['selected']
        elif key == 10 or key == 13: # Enter
            play_sound(sounds[current_row])
            message = f"Playing {sounds[current_row]['prefix']}..."
        elif key in [ord('p'), ord('P')]:
            selected_sounds = [s for s in sounds if s['selected']]
            if selected_sounds:
                message = "Playing sequence..."
                stdscr.addstr(height - 1, 0, message, curses.A_STANDOUT)
                stdscr.refresh()
                for s in selected_sounds:
                    play_sound(s, blocking=True)
                message = "Sequence finished."
            else:
                message = "No sounds selected for sequence (use Space)."
        elif key in [ord('s'), ord('S')]:
            save_sounds(content, sounds)
            message = "Saved successfully to game/js/ui/sound.js!"
            # Reload content for safe replacing next time
            content, _ = parse_sounds()
        elif key in [ord('q'), ord('Q')]:
            break

if __name__ == "__main__":
    curses.wrapper(main)
