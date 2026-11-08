# HustleHub+Secure Freelance Marketplace (MERN)

HustleHub+ is a full-stack MERN marketplace where **Freelancers** list services (gigs) and **Clients** browse and book them through a simulated payment. Every booking creates a transaction record, each freelancer's income is tracked from those transactions, and that income is turned into an estimated SARS tax bill with a charted breakdown.

The project is containerised, covered by 85 backend and 57 frontend automated tests plus a 123-assertion API security suite, analysed by two independent static analysis tools, and built by a GitHub Actions pipeline that fails on any failing check.

---

## Features

**Everyone**

* Register and log in as a Client or a Freelancer (JWT authentication)
* Browse and search gigs by keyword and category

**Freelancers**

* Create, update and delete their own gigs
* See bookings received and the transactions behind them
* **Income & tax dashboard:** income for the current tax year charted month by month, an estimated tax bill, take-home pay, effective and marginal rates, a bracket-by-bracket breakdown and the top earning gigs
* Adjust the estimate for deductible business expenses and age group

**Clients**

* Book a gig with a simulated payment
* View their own bookings and transactions

Each booking and its transaction are written together inside a single MongoDB transaction, so a payment record can never exist without its booking, or the reverse.

---

