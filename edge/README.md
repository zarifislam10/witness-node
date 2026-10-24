# Witness-Node — Edge Agent (Raspberry Pi)

Event-driven agent. Sleeps until the limit switch or button fires, then captures a photo, POSTs it to the backend, and plays back the returned MP3 through the JBL speaker.

## Install (on the Pi)

```bash
sudo apt update
sudo apt install -y fswebcam mpg123 python3-pip python3-rpi.gpio
pip3 install -r requirements.txt
```

## Run

```bash
export WITNESS_BACKEND_URL="https://<your-vultr-host>/incident"
export WITNESS_NODE_ID="node-001"
python3 witness_node.py
```

## Wiring (BCM pins)

| Component          | Pin  |
| ------------------ | ---- |
| Roller limit sw.   | 17   |
| Tactile button     | 27   |
| Webcam (USB)       | USB  |
| JBL speaker        | 3.5mm / USB |

Both switches use internal pull-ups; wire the other leg to GND. Falling edge = trigger.
