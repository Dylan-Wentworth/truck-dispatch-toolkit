# Broker rate negotiation playbook

A practical talk track for dispatcher-to-broker rate calls. The
premise is simple: you negotiate from your numbers, not from the
board's mood. Run your lane history, your break-even, and the truck's
position before the call, and let the broker negotiate against your
data instead of the other way around.

## Before the call (two minutes)

- **Your lane average.** What has this lane actually paid you? Run
  `lane-check` against your lane book. No history on the lane: use
  the closest lane you do run, and say so honestly if asked.
- **Your floor.** Break-even per mile on all miles (use the `rate`
  command with deadhead included). Below the floor, the load costs
  money to haul and the answer is no at any volume.
- **The truck's real position.** Where the truck empties, when, and
  what the next market looks like. A truck emptying into a strong
  market is worth more than the posted rate suggests.

## The call

### Open with facts, not a price

Ask the questions that decide the rate before money comes up:
pickup and delivery windows, weight, commodity, loading method,
appointment or first come first served, and whether the load is
posted for one truck or five. Every answer either justifies your
number or explains theirs.

### Anchor on your data

When the rate comes up, name your number with its reason attached:

> "We run Dallas to Oklahoma City every week. Our booked average on
> that lane is $3.00 a mile, and this load has a tight delivery
> window on top of it. I can do it at $1,650."

A rate with a reason is hard to argue with. A rate by itself is just
the start of a haggle.

### The counter: your average plus 10

When the offer lands under your average but the lane and timing work,
counter at your average plus 10 percent. That is what `lane-check`
suggests on a lowball. The 10 percent is not greed; it is your
settling room. The broker counters back, and you land at or near the
average you were defending in the first place, with the relationship
intact.

Concede slowly and trade, never just give: each step down buys
something real. Faster payment terms, detention wording, an extra
day on the delivery window, or the next load on the lane.

### The walk-away line

Decide it before the call and use it once, calmly:

> "Below $1,500 the load loses money against our cost per mile, so
> I have to pass. If the rate moves, my truck is still here until
> three."

Then stop talking. Silence is part of the offer. Loads that come
back an hour later at your number are common; loads chased down
another $200 almost never pay what the chase cost.

## Before you book: get the accessorial terms in writing

The rate is half the deal. The other half is what happens when the
load goes sideways, and it is only real if it is on the rate
confirmation before the truck rolls. Confirm each of these in
writing, on the rate con or by email reply:

- **Detention:** the free time at shipper and receiver (2 hours is
  standard), the hourly rate after that, and what counts as proof
  (in and out times on the BOL, ELD timestamps).
- **Layover:** the per-day amount when the truck is held over, and
  who authorizes it.
- **TONU:** the truck ordered, not used amount if the load cancels
  after dispatch or after the truck arrives.
- **Lumper fees:** reimbursed at cost against the receipt, stated
  on the rate con.
- **Payment terms:** the day count (net 30 or otherwise), any
  quick-pay option and its percent, and the exact name and address
  invoices go to.
- **Cancellation:** what happens if the load cancels before pickup,
  and how late that can happen free of charge.

If a broker will not put detention and TONU terms in writing, that
is credit information. Price the risk into the rate, factor the
invoice, or pass. The `broker` scorecard in this toolkit exists
because the brokers who resist written terms are usually the ones
whose invoices age.

## After the call

Booked or not, record the outcome. Booked loads go in the lane book
(`lane-add`) so the next negotiation on that lane starts from your
data, and declined offers are worth noting too: the third time a
broker's ceiling is under your floor, the lane is theirs, not yours.
