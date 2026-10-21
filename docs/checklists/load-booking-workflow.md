# Load Booking Workflow

From first rate quote to filed POD. The goal: no load moves without the
paperwork and the check calls to prove where it is.

## 1. Rate and negotiation

- [ ] Confirm the full load spec: equipment, weight, commodity, pallet
      count, pickup and delivery windows, appointment or FCFS
- [ ] Price the lane with all miles, not just loaded miles. Use
      `dispatch-toolkit rate` so deadhead is in the number you negotiate
- [ ] Agree accessorials up front and in writing: detention rate and free
      time, layover, TONU, lumper handling, driver assist, hazmat
- [ ] Walk-away number set before the call, based on your break-even RPM

## 2. Carrier assignment

- [ ] Carrier vetted (see pre-book-carrier-vetting.md)
- [ ] Driver assigned: name, cell phone, truck number, trailer number
- [ ] Tracking activated and confirmed working before dispatch
      (MacroPoint, Trucker Tools, project44, or ELD share)

## 3. Rate confirmation

- [ ] Rate con sent with the agreed total, all accessorial terms, and
      detention free time spelled out in hours
- [ ] Signed rate con received back before the truck rolls. No signature,
      no dispatch
- [ ] Pickup number, reference numbers, and special instructions repeated
      back to the driver verbally, not just sent by text

## 4. Pickup

- [ ] Check call: driver on site at appointment time. Log arrival time;
      this timestamp starts the detention clock
- [ ] BOL received and photographed: piece count, weight, seal number,
      and any shipper notes match the rate con
- [ ] Discrepancies (count, weight, packaging) reported to the broker
      before the driver leaves the dock, and noted on the BOL
- [ ] Departure time logged. If hold time exceeded free time, start the
      detention file the same day (see the detention calculator and
      claim letter in this toolkit)

## 5. In transit

- [ ] Check calls at the agreed cadence, minimum: departure, midday,
      evening, and pre-delivery
- [ ] ETA recomputed after every stop. Hours-of-service feasibility
      re-checked with `dispatch-toolkit hos` if the ETA slips
- [ ] Temperature logs pulled for reefer loads at every check call
- [ ] Problems raised early: a late load with 8 hours of warning is a
      reschedule; a late load with 30 minutes of warning is a service failure

## 6. Delivery

- [ ] Arrival and departure times logged at the receiver
- [ ] Signed POD collected, photographed, and sent to the broker within
      1 hour of delivery
- [ ] OS&D (overage, shortage, damage) noted on the POD before signing
      whenever anything is off. A clean signature with a shortage is a
      claim you will lose
- [ ] Empty status and next available position confirmed with the driver

## 7. Billing and file close

- [ ] Invoice packet assembled: invoice, signed rate con, BOL, POD,
      lumper receipts, detention documentation
- [ ] Sent to broker or factoring company the same business day
- [ ] Detention or layover claims filed within the broker's claim window
      (many are 30 days; some are as short as 7)
- [ ] Lane result recorded: final RPM on all miles, detention collected,
      and notes on the facility, so the next quote on this lane is smarter
