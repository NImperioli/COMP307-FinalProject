# MyBookings - McGill Booking Application

## How to access the website

```
cd app/backend
npm install
npm start
```

Open the website's URL in your browser:
 http://winter2026-comp307-group38.cs.mcgill.ca:3000/landing.html

## To access the database:
```
mongosh
> show dbs
> use db_name
> show collections
> db.collectionName.find()
```

## Team — Group 38

| Name | McGill ID | Code Worked On |
|------|-----------|----------------|
| Nicholas Imperioli | 261120345 | All MongoDB models (userModel, slotModel, bookingModel, reservationModel), all backend controllers (slotController, bookingController), all routes (slotRoutes, bookingRoutes), bookingService, icalService, notificationService, authMiddleware, db.js, recurring office hours (Type 3), group meeting (Type 2), server.js |
| Annie Huynh | 261182881 | authController.js, authRoutes.js, server.js; wired all frontend pages to the backend (login, register, dashboard, browse-owners, owner-slots); iCal export feature; dashboard.html, owner-manage-slots.html, owner-slots.html, browse-owners.html, login.html, register.html |
| Taym Atrach | 261183855 | Frontend UI and design: landing.html, login.html, register.html layout and styling; background animations; UI overhaul; dashboard.html, browse-owners.html, owner-manage-slots.html, owner-slots.html; token-checker display logic on dashboard |
| William Borlase | 261143451 | authMiddleware, slotModel, server.js, db.js; initial dashboard owner-slot views; token/role-based routing on the frontend; register fetch request fix |

## 30% Not Hand-Coded

The following portions of the project were not written from scratch by the team (~30% or less):

| Component | Source / Tool | Files Affected |
|-----------|--------------|----------------|
| Express.js framework | npm library | `backend/server.js`, `backend/src/routes/` |
| Mongoose ODM | npm library | `backend/src/models/` |
| jsonwebtoken | npm library | `backend/src/middleware/authMiddleware.js`, `backend/src/controllers/authController.js` |
| bcrypt | npm library | `backend/src/controllers/authController.js` |
| ical-generator | npm library | `backend/src/services/icalService.js` |
| wave effect | youtube template: https://www.youtube.com/watch?v=2dPISFndyKg | `dashboard.html`, `browse-owners.html`, `owner-manage-slots.html`, `owner-slots.html` |
| [Any LLM-assisted code] | Claude / ChatGPT | getting the cancel and completed buttons to work in `dashboard.html` + organizing the code so that it's clearer in dashboard.html and owner-slots.html + floating elements in `landing.html`|

Approximate amount of lines not written from scratch: ~1600 lines

The remaining 70%+ was written by hand by the team members listed above.
