# Embedding browser-linux

Drop the v86 + buildroot image into any web page in two `<script>` lines.

## Files you need

These five files have to be reachable over HTTP from the browser. They can
live anywhere; you tell the library where via `v86Base` / `imageBase`.

| File                 | Source                              | Approx size |
|----------------------|-------------------------------------|-------------|
| `libv86.js`          | <https://copy.sh/v86/> or v86 build | ~600 KB     |
| `v86.wasm`           | same                                | ~1.5 MB     |
| `seabios.bin`        | same                                | ~256 KB     |
| `bzImage`            | `output/images/` after a buildroot build | ~7 MB  |
| `rootfs.squashfs`    | `output/images/` after a buildroot build | ~4 MB  |

Plus one of ours:

| `browser-linux.js`   | this directory                      | ~7 KB       |

## Minimal embed

```html
<!doctype html>
<html><body>

<div   id="term"  style="height:60vh;background:#000;color:#0f0;
                          font:13px/1.2 monospace;white-space:pre-wrap;
                          padding:.4em;overflow-y:scroll"></div>
<input id="cmd"   style="width:100%;font:13px monospace"
                  placeholder="type and press Enter">
<button id="boot">Boot</button>

<script src="libv86.js"></script>
<script src="browser-linux.js"></script>
<script>
  const linux = new BrowserLinux({
      v86Base:   "./",     // dir holding libv86.js, v86.wasm, seabios.bin
      imageBase: "./",     // dir holding bzImage, rootfs.squashfs
      container: "#term",
      input:     "#cmd",
  });
  document.getElementById("boot").onclick = () => linux.boot();
</script>

</body></html>
```

That's it. Click Boot, wait for the kernel to come up, type into the input
box, hit Enter — the line is sent to the VM's `ttyS0` and the shell echoes.

## API

```js
const linux = new BrowserLinux(opts)
```

`opts` keys:

| key          | type                | required | meaning                                       |
|--------------|---------------------|----------|-----------------------------------------------|
| `v86Base`    | string              | yes      | URL prefix for `v86.wasm`, `seabios.bin`      |
| `imageBase`  | string              | yes      | URL prefix for `bzImage`, `rootfs.squashfs`   |
| `container`  | element \| selector | no       | DOM element to render terminal output into    |
| `input`      | element \| selector | no       | `<input>` whose Enter/Tab/Ctrl-C/D/L go to VM |
| `cmdline`    | string              | no       | Override kernel command line                  |
| `memoryMB`   | number              | no       | RAM size, default 128                         |
| `onStatus`   | function(string)    | no       | "loaded" / "CPU running" / "download error"   |
| `onByte`     | function(int)       | no       | Raw byte from ttyS0 (after ANSI strip filters)|
| `onText`     | function(string)    | no       | Same text we paint into the container         |

Methods:

| method                | returns       | what                                          |
|-----------------------|---------------|-----------------------------------------------|
| `boot()`              |               | start the VM (no-op if running)               |
| `reset()`             |               | restart the VM (kernel reboot)                |
| `destroy()`           |               | stop CPU, remove keyboard listener            |
| `send(str)`           |               | write string bytes to ttyS0                   |
| `uploadFile(File)`    | `Promise<bool>`| copy a `File` into `/mnt/web/<name>` via 9P  |
| `readFile(path)`      | `Promise<Uint8Array>` | read `/mnt/web/<path>` back from the VM (or `null` if 9P not ready) |
| `clear()`             |               | clear the on-screen terminal (VM unaffected)  |

## JS ↔ VM communication channels

There are two channels open between the page's JavaScript and the VM. Both
are bidirectional. Pick whichever fits the data shape you want to move.

### Channel A — ttyS0 byte stream

The serial port `/dev/ttyS0` inside the VM is wired straight to the page.
It does double duty: it's the login console (so the user sees a shell
prompt), AND it's a raw byte channel JS can send/receive on at any time.

| direction | JS API | VM end |
|-----------|---------------------------------|---------------------------|
| JS → VM   | `linux.send("ls\n")`            | bytes appear on `/dev/ttyS0` (read by getty/shell or by your own daemon) |
| VM → JS   | `onByte(b)` / `onText(s)` cb    | anything written to `/dev/ttyS0` (kernel printk, shell echo, your script's `printf`) |

Practical use:
- Drive the shell programmatically: `linux.send("uname -a\n")`, watch
  `onText` for the result.
- Or run a custom protocol: have a busybox script in the VM do
  `read line < /dev/ttyS0; echo "RESPONSE:$line"` to do request/reply.

Note: the shell echoes everything you send. If you want a "clean" RPC
channel without shell echo, run your own daemon on the VM that owns
ttyS0 (the simplest: kill the getty so nothing else writes, then have
a script `cat /dev/ttyS0 | while read line; do …; done`).

### Channel B — 9P file share at `/mnt/web`

A virtual 9P filesystem is exposed at `/mnt/web` in the VM. Files written
on either side are visible to the other. Storage is in browser memory
(resets on page reload).

| direction | JS API | VM end |
|-----------|---------------------------------|---------------------------|
| JS → VM   | `linux.uploadFile(file)` (from a `<input type="file">` File object) | the file appears as `/mnt/web/<file.name>` |
| VM → JS   | `linux.readFile("foo.bin")` returns `Promise<Uint8Array>` | reads `/mnt/web/foo.bin` |

Use this when you want to move bigger blobs, or when you'd rather speak
plain "files" than crafting a serial protocol. For example:

```js
// JS side — push a header file in, ask the VM to compile something,
// pull the resulting binary back out.
await linux.uploadFile(new File([sourceCode], "main.c"));
linux.send("tcc -o /mnt/web/main /mnt/web/main.c\n");
// …wait for shell prompt to come back via onText…
const binary = await linux.readFile("main");
```

## What the embedded VM gives you

- `i686 + musl + busybox + sudo + tcc` (Tiny C Compiler)
- Auto-login as `guest` (uid 1000)
- `root` is locked: shell `/sbin/nologin`, password hash `*`
- `/`, `/usr`, `/etc`, `/bin`, … are read-only (squashfs)
- `/home/guest`, `/root`, `/tmp`, `/run` are tmpfs (cleared on reload)
- `/mnt/web` is the 9P upload target — anything passed to `uploadFile()`
  appears there inside the VM
- No network, no display, no sound

## Customising

### Different cmdline

```js
new BrowserLinux({
    /* … */
    cmdline: "root=/dev/sda rootfstype=squashfs ro console=ttyS0,115200 quiet",
});
```

The defaults (`noapic nolapic notsc 8250.nr_uarts=1 8250.skip_txen_test=1`)
are tuned for v86's incomplete LAPIC/IOAPIC/TSC/UART emulation; you only
need to change them if you target a different emulator.

### React to VM output programmatically

```js
new BrowserLinux({
    /* … */
    onText: text => {
        if (text.includes("hello from v86")) console.log("VM said hi");
    },
});
```

The `onByte` callback gives you raw bytes (post-ANSI-strip filtering); use
it if you want to drive your own terminal renderer (xterm.js etc.) instead
of the built-in plain DIV.

### Use xterm.js for proper colors

The built-in container is a plain `<div>` and **strips** ANSI escapes (so
`ls --color` outputs come through as plain text). If you want colors, swap
in xterm.js:

```js
import { Terminal } from "xterm";
const term = new Terminal();
term.open(document.getElementById("term"));

const linux = new BrowserLinux({
    /* … */
    container: null,                // disable our DIV renderer
    onByte:    b => term.write(Uint8Array.of(b)),
});
```

## Limitations

- The plain-DIV terminal does not handle backspace-erase, cursor moves,
  or color. Use xterm.js for a real terminal experience.
- The 9P share is in-memory only (resets on page reload). Persist via
  IndexedDB or your own backend if needed.
- v86 is a JS x86 emulator: a few MIPS at best on a fast laptop. It's fine
  for shell + small `tcc` builds, not for compiling Linux.
