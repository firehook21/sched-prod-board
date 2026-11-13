---
id: SCHED-4515
title: Ack asks to confirm, naming the incident id
status: done
plan: R2
---

Step-one recording, 00:07: on-call aimed at INC-4363, a new incident pushed the list down, and the click
acked INC-8802. Product's decision: new incidents stay live at the top and Ack stays on the row, but Ack
asks to confirm, and the confirm names the incident id.

- Ack (`data-testid="ack"`) opens a confirm (`data-testid="confirm"`) that names the incident id; the id is
  pinned when the confirm opens, so later refreshes cannot change it.
- Confirm (`data-testid="confirm-ack"`) sends `api.ack(id)` for that id; Cancel (`data-testid="confirm-cancel"`)
  or Escape sends nothing.

Acceptance: a click on Ack never acks on its own; the confirm shows the id that will be acked.
