# Privacy & legal implementation audit — source facts

**Scope:** repository-only audit, prepared before drafting any Privacy Policy or Terms. No production, provider dashboard, database, Cloudinary, or email-service connection was made. Statements below describe code, not legal conclusions.

## 1. Executive factual summary

- The public product is consistently presented as **Arun Thai** / **Arun Thai Language Center**. The public canonical URL is `https://arunthaiedu.com/` ([Frontend index](../apps/Frontend/index.html), [SEO](../apps/Frontend/src/components/Seo.jsx)). Backend Cloudinary folders and some historical/test/configuration names use **English Kafe** / `english_kafe`; this is a material legacy-naming inconsistency.
- Accounts have only `user` (student) and `admin` roles; no instructor/teacher role or separate instructor account model was found ([User model](../apps/Backend/models/userModel.js)). Public visitors can browse public content and submit a contact enquiry; students authenticate for learning, payments, profile, feedback and deletion; admins operate management APIs/UI.
- MongoDB/Mongoose stores application records. Cloudinary stores uploaded images/proofs. Resend sends transactional and marketing email. Browser links can send a visitor to Facebook. Static public login imagery includes Unsplash. No Google Analytics, GTM, Meta Pixel, TikTok Pixel, Hotjar, Clarity, Mixpanel, Segment, Sentry, CAPTCHA, advertising SDK, or fingerprinting implementation was found by source search.
- Authentication uses a short-lived JWT access token held only in JavaScript module memory, plus a hashed opaque refresh-token session stored in MongoDB and delivered in an HttpOnly cookie. The student app uses `localStorage` only for quiz drafts; no access token is stored there.
- The implementation contains substantive retention mechanisms, but production execution is **manual at launch**: Render Free plan, Atlas Free cluster, no automated retention scheduling ([retention runbook](retention-operations.md)). Code policy and production execution must be described separately.

## 2. Personal-data inventory

| Category | Data and storage | Evident purpose / access / exposure | Retention and transfers |
| --- | --- | --- | --- |
| Registration/profile | `User`: name, email, bcrypt password hash, role, verification/reset token fields, active/verified/session state, avatar URL/public ID, timestamps ([model](../apps/Backend/models/userModel.js)). | Account, login, profile. Student sees own profile; Admin manages users and sees user records. Public does not receive ordinary profiles. | User deletion removes the User and private learning records; avatar is durably queued for Cloudinary cleanup. Email verification/unverified-user expiry is modelled; exact operational timing is environment/service-dependent. |
| Authentication/security | JWT claims include ID, role, session version; `RefreshSession` stores user ID, SHA-256 token hash, session version, expiry/revocation/timestamps ([session model](../apps/Backend/models/refreshSessionModel.js), [session service](../apps/Backend/services/sessionService.js)). | Authentication, refresh rotation, invalidation. Not public; token data is not returned as a profile field. | Refresh-session TTL uses `expiresAt`; account deletion revokes active sessions and deletes account-confirmation records. |
| Course/enrollment/learning | Enrollment: user/course IDs, optional payment ID, completion IDs, last opened lesson/time. Quiz attempts: user/quiz IDs, answers, score, attempt number. Personal decks/cards: owner ID and user-entered prompt/answer. Review progress: card ID/timestamps/rating/count/interval ([models](../apps/Backend/models/enrollmentModel.js), [quiz attempts](../apps/Backend/models/quizAttemptModel.js), [review progress](../apps/Backend/models/flashcardReviewProgressModel.js)). | Course access, progress, quizzes, spaced-repetition practice. Student sees own data; Admin has course/quiz reporting views. | Student deletion deletes Enrollment, quiz attempts, personal decks/cards and review progress. No independent general retention period was found for these records. |
| Payments | `Payment`: pseudonymous `userId`, course ID and course snapshot, amount/currency/discount/refund, payment-method ID/snapshot, promo fields, status, reviewer IDs/times, proof references, structured rejection code/note and legacy `rejectReason` ([model](../apps/Backend/models/paymentModel.js)). | Manual-payment checkout, review, order history, reconciliation. Student sees own payments; Admin list populates user name/email/avatar and reviewer name/email. | Final terminal-Payment deletion is eligible seven calendar years from `createdAt`, subject to holds, claims and dependencies; manual at launch. MongoDB holds linked data; Cloudinary holds proofs. |
| Payment proof | Authenticated/legacy Cloudinary public ID, format/storage and legacy URL fields are select-hidden in Payment. | Student uploads image proof; Admin can view authorized proof; rejected student can obtain its proof path under server controls ([payment routes](../apps/Backend/routes/payment.js)). | Approved/rejected proof is eligible at 12 calendar months from `reviewedAt`, unless hold/dependency blocks it; durable cleanup then removes asset/reference. |
| Promo/redemption | Promo code string on Payment and `PromoRedemption`: promo/user/payment IDs, active/release state/timestamps ([model](../apps/Backend/models/promoRedemptionModel.js)). | Discount validation and financial linkage. Admin/payment logic; not public. | Remains through Payment lifecycle; safely associated redemption is deleted with final Payment. |
| Feedback/testimonials | Student/course IDs; immutable 20–2,000-char feedback; publication consent/status, preferred public name, avatar permission and dates; Admin reviewer/times ([model](../apps/Backend/models/studentFeedbackModel.js)). | Private course feedback, optional public testimonial. Student sees own; Admin moderates; public endpoint returns only published/permitted quote, derived display name and optionally avatar. | Student account deletion deletes feedback. No separate retention rule found for non-deleted accounts. |
| Contact/marketing | `ContactLead`: name, email, consent status, opt-in/withdrawal timestamps and sources. `ContactEnquiry`: lead ID, message (max 2,000), submitted/read timestamps ([models](../apps/Backend/models/contactLeadModel.js), [enquiry](../apps/Backend/models/contactEnquiryModel.js)). | Public enquiries, Admin inbox, marketing eligibility. Admin sees leads/enquiries; public receives only own submission response. | Enquiry TTL 365 days; unsubscribed enquiry-free lead is minimized then deleted three calendar years after withdrawal; manual cleanup at launch. |
| Campaign/email | Campaign subject/message, selected recipient snapshot (name/email/record type/ID), delivery counts/status/times, optional image/public ID, creator ID ([model](../apps/Backend/models/campaignModel.js)). | Admin marketing sends to subscribed ContactLeads; recipient snapshot and campaign content are Admin-only. | Campaign lifecycle is 12 calendar months with durable owned-image cleanup. Email is sent through Resend. |
| Notifications/audit | Notification: user/course IDs, type, title/message/link/read state. AuditLog: actor/target IDs, action, mixed metadata and expiry ([models](../apps/Backend/models/notificationModel.js), [audit](../apps/Backend/models/auditLogModel.js)). | Student/admin operational notices and Admin/security history. Admin can obtain audit logs; notifications are user-specific. | Audit action classification gives six or 12 calendar months and TTL expiry. Deletion events use a pseudonymous/linkable target ID and `initiatedBy`, not deleted student name/email ([logger](../apps/Backend/services/auditLogger.js), [deletion](../apps/Backend/services/studentAccountDeletion.js)). |
| Images/assets | Avatar, course/blog/lesson/quiz/campaign images, PaymentMethod QR images, payment proofs. Uploads use Cloudinary; image public IDs establish ownership where supported. | Display, course content, checkout instructions, proof review. Public exposure depends on content; proof access is authenticated/server-mediated. | Owned avatar, campaign, QR and proof assets have durable cleanup paths; course/blog/quiz image lifecycle should be separately confirmed if legal text will discuss it. |

**Direct identifiers:** name, email, uploaded avatar/proof/image contents, free-text messages/feedback/card content, payment-recipient snapshot details, campaign recipient snapshots. **Pseudonymous/linkable data:** MongoDB ObjectIds such as User/Payment/Enrollment/PromoRedemption IDs, token hashes, claims, course progress, audit target IDs. **Operational metadata:** IP-based rate-limit state (not modelled as a MongoDB schema here), timestamps, session/version, read/delivery/claim/hold state.

## 3. Free-text, uploads, and potentially additional data

| Input | Controls found | Notes |
| --- | --- | --- |
| Profile | Name and avatar file. User model trims name; avatar is image upload. | Avatar can depict a person. |
| Contact | Name/email required; message optional, model max 2,000; honeypot `website`; public route max five/hour ([controller](../apps/Backend/controllers/contactController.js), [UI](../apps/Frontend/src/components/ContactSection.jsx)). | UI has no visible message length counter; server schema is the bound. |
| Personal flashcards | Prompt/answer; model limits are 280/1,000 characters. | Student-entered learning content can contain personal data. |
| Feedback | Plain-text, trim, 20–2,000 characters; one per student/course ([controller](../apps/Backend/controllers/studentFeedbackController.js)). | May be private or deliberately made public. |
| Payment proof | JPEG/PNG/WEBP/GIF, signature checked, max 5 MB ([upload middleware](../apps/Backend/middleware/uploadValidation.js)). | Image may contain names, account/payment details, reference numbers or other information. |
| Payment method / QR | Admin may enter recipient account name/number/bank/phone/reference hint/instructions and upload QR image. | These normally describe the payment recipient; code does not establish whose identity each value represents. |
| Rejection reason | Admin must use `receipt_unreadable`, `receipt_incomplete`, or `receipt_unverifiable`; optional `rejectionNote` max 300. Legacy unrestricted `rejectReason` remains readable for compatibility ([Payment model](../apps/Backend/models/paymentModel.js), [controller](../apps/Backend/controllers/paymentController.js)). | Notes/free-text could contain unnecessary information despite the limit. |
| Campaign | Admin subject/message and optional image; recipient snapshots include name/email. | Campaign content can contain arbitrary text. |

## 4. Data-flow and external-resource inventory

| Service/resource | Source-verified purpose and data flow | Browser/server and conditionality |
| --- | --- | --- |
| MongoDB / Atlas (owner context says Free cluster) | Mongoose `MONGO_DB` holds all models above ([DB config](../apps/Backend/config/dbConnection.js)). | Backend only. Atlas hostname/region, backup/PITR, subprocessors and contractual terms are not in the repository. |
| Cloudinary | Upload/serve/delete images, avatars, campaign images, QR images and payment proofs ([config](../apps/Backend/config/cloudinary.js), [proof storage](../apps/Backend/services/paymentProofStorage.js)). | Backend upload/delete; browser receives permitted image URLs or streams. Existing configured cloud/account/region cannot be verified without secrets/dashboard. |
| Resend | Sends verification/reset, payment review, marketing subscription confirmation and campaigns using recipient email and HTML containing relevant name/course/rejection/campaign data ([email service](../apps/Backend/services/sendEmail.js), [contact controller](../apps/Backend/controllers/contactController.js)). | Backend only; conditional on event/marketing send. Actual sending domain/provider region cannot be verified. |
| Render (owner context says Free plan) | Hosting/deployment is owner-provided operational context; no Render configuration was found in source. | Cannot verify service region, runtime logs, environment values or scheduler from repository. |
| Facebook | Public contact link opens `facebook.com/profile.php?id=100062810408389` ([contact links](../apps/Frontend/src/config/contactLinks.js)). | Browser navigation only when visitor clicks. Facebook then receives normal navigation data under its own operation. |
| Unsplash | Admin login references an Unsplash image URL ([AdminLogin](../apps/Admin/src/pages/AdminLogin.jsx)). | Browser fetch during Admin login-page render. |
| Google Fonts / YouTube | No Google Fonts stylesheet/import and no YouTube embed was found in source search. | Not implemented by the inspected source. |

No DiceBear or UI Avatars production reference was found; student fallbacks are local initials/icon and Admin preserves only uploaded avatar URLs (see related source/tests under `apps/Frontend/src/components` and `apps/Admin/src/services/userService.js`).

## 5. Authentication, cookies, browser storage and tracking

- **Access JWT:** Bearer header; expiry default 15 minutes; role/sessionVersion claim is checked against current User data ([session service](../apps/Backend/services/sessionService.js), [auth middleware](../apps/Backend/middleware/authMiddleware.js)). It is module-memory only (`tokenStorage.js`), not persistent browser storage.
- **Refresh cookie:** opaque refresh token; HttpOnly; `Secure` in production; `SameSite=None` in production and `Lax` otherwise; path `/auth`; default 14 days. The database keeps only its hash. Separate generic/student/admin cookie names exist.
- **CSRF-related facts:** credentialed CORS permits only configured exact origins and authorizes headers/methods; production cookie is cross-site `SameSite=None`. No separate CSRF-token/double-submit middleware was found. This is a technical fact, not a conclusion about adequacy.
- **Browser storage:** Frontend `localStorage` stores `quiz-draft:<user>:<course>:<lesson>:<quiz>` draft answers/progress and clears that user’s drafts after account deletion/logout. Admin startup removes keys from retired local/session-storage auth flows; current Admin access token is in memory. No IndexedDB use found. No persistent access token found.
- **Non-essential cookies/tracking:** no source evidence of analytics, advertising, fingerprinting or other non-auth cookies. The technical implementation has an authentication refresh cookie and local quiz-draft storage. Whether a consent banner is legally required cannot be determined from code.

## 6. Payment privacy lifecycle — factual map

Manual checkout captures a Payment tied to `userId` and `courseId`, a course snapshot, financial amounts/currency, PaymentMethod ID and immutable method snapshot, promo link, proof reference, status and review data. A QR snapshot may include URL/public ID; recipient snapshot can include account name/number/bank/phone/reference hint/instructions. The snapshot’s detailed recipient/QR/instruction fields are minimized after 12 calendar months from `reviewedAt` for approved/rejected payments unless a hold or worker claim blocks it ([snapshot service](../apps/Backend/services/paymentSnapshotMinimization.js)).

Proof images reside in Cloudinary authenticated/legacy storage. A terminal approved/rejected proof becomes eligible after 12 calendar months from `reviewedAt`; an active dispute/refund/investigation hold blocks cleanup ([proof retention](../apps/Backend/services/paymentProofRetention.js)). Admin review records reviewer ID/time, structured rejection code and optional 300-character note; legacy `rejectReason` can still exist.

Payments retain `userId` for their lifecycle. Student deletion deliberately leaves Payment and PromoRedemption outside the student-account transaction. At final seven-calendar-year terminal-Payment cleanup, code revalidates holds/claims/proof dependencies, unsets every matching optional `Enrollment.paymentId`, deletes the safe associated PromoRedemption and then deletes the Payment atomically ([final retention](../apps/Backend/services/paymentFinalRetention.js)). Enrollment/course access does not require `paymentId` ([Enrollment model](../apps/Backend/models/enrollmentModel.js)). Execution is manual at launch.

## 7. Contact and marketing lifecycle

- Public contact form submits name, email, optional message, checkbox `marketingOptIn`, and hidden honeypot. The displayed checkbox says: “I’d like to receive course updates, new class announcements, promotions, and other news … by email. I can unsubscribe anytime.”
- Consent is authoritative only in `marketingConsent.status`: `never_subscribed`, `subscribed`, `unsubscribed`. A checked form explicitly subscribes and records `lastOptedInAt`/`lastOptInSource: contact_form`; unchecked preserves the existing state. Thus unchecked submission neither subscribes a never-subscribed contact nor revokes a subscribed/unsubscribed contact ([contact controller](../apps/Backend/controllers/contactController.js)). Every legitimate submission creates a separate ContactEnquiry transactionally.
- Unsubscribe JWT link changes status to `unsubscribed`, writes withdrawal time/source and removes opt-in provenance. A later checked form can explicitly re-subscribe and records fresh provenance. An unchecked later form leaves the person unsubscribed.
- Only `subscribed` leads are selected by the Admin campaign UI; campaigns snapshot recipient name/email/record type/ID. Resend receives campaign recipient email and rendered campaign content. Subscription confirmation email is sent only after a transition into subscribed, not merely a contact enquiry.
- Admin sees lead name/email, consent status, latest enquiry/time and unread count; opening history marks enquiries read. No Admin delete or manual-consent-change endpoint was found.

## 8. Testimonials/publication lifecycle

Submitted feedback is private by default. A student who is enrolled and has completed at least one lesson may submit one feedback record per course. The student may permit publication with either first name or anonymous display name and separately allow an avatar only with first-name display. Permission places it awaiting Admin review. Admin can publish/not select; the public testimonial endpoint filters for both permitted consent and published status and exposes only quote, derived display name, and allowed avatar ([feedback controller](../apps/Backend/controllers/studentFeedbackController.js), [testimonial controller](../apps/Backend/controllers/testimonialController.js)). A student can withdraw publication permission; account deletion removes feedback. No student self-service feedback-text edit/delete was found after creation.

## 9. Account deletion matrix

### Deleted / anonymized / unlinked

- Deleted in one transaction: User, Enrollment, personal flashcards/decks, flashcard review progress, quiz attempts, notifications, support tickets, StudentFeedback, account-deletion confirmation, and student-owned deletion-confirmation records ([student deletion service](../apps/Backend/services/studentAccountDeletion.js)).
- Refresh sessions are revoked; account token/session version makes prior tokens unusable.
- Current avatar public ID is queued for durable Cloudinary cleanup after commit. Previous-avatar replacement uses the same durable cleanup approach.
- At *later final Payment deletion*, every Enrollment `paymentId` is unset (Enrollment itself/access remains) and a safely associated PromoRedemption is deleted.

### Retained after account deletion

- Payment remains for its seven-year financial lifecycle and retains linkable `userId`; related PromoRedemption remains until final payment cleanup.
- AuditLog survives its independent six/12-month TTL; deletion event contains actor/target ObjectIds and `{ initiatedBy }`, not deleted name/email. IDs remain pseudonymous/linkable rather than anonymous.
- Campaign recipient snapshots/other campaign records are not deleted by account deletion.
- ContactLead/ContactEnquiry and marketing consent are independent from User; there is no User foreign key. A student who used the contact form can therefore retain a separate lead/enquiry after account deletion.
- Public course/blog/content records are not student-owned deletion targets.

Marketing consent is technically independent from learning-account deletion.

## 10. Retention matrix

| Data | Code policy / trigger | Mechanism | Production execution at launch |
| --- | --- | --- |
| ContactEnquiry | 365 days from `submittedAt` | MongoDB TTL index | Automatic database TTL behavior; no app scheduler required. |
| Unsubscribed ContactLead, no enquiry | Minimize while unsubscribed; delete three calendar years after `withdrawnAt` | Transactional cleanup with claims | Manual worker. |
| Payment | Terminal approved/rejected: seven calendar years from `createdAt`; blocks include hold, claims, proof dependencies/relationships | Transactional final cleanup | Manual worker; first production run needs dry-run/operator review. |
| Payment proof | 12 calendar months after terminal `reviewedAt` | Durable Cloudinary cleanup / holds | Manual worker. |
| Payment snapshot detail | 12 calendar months after terminal `reviewedAt` | Claim/revalidation then unset detail fields | Manual worker. |
| Campaign / image | 12 calendar months (`expiresAt`); image cleanup before campaign removal where required | Durable owned-asset cleanup | Manual worker. |
| AuditLog | Six or 12 calendar months by classified action | `expiresAt` MongoDB TTL | Automatic database TTL behavior. |
| Account avatar/outbox | After successful account deletion/replacement, retry until cleaned | AccountAssetCleanup durable work | Manual retry worker at launch. |
| PaymentMethod QR | After replacement/deactivation when unreferenced | Durable QR cleanup, revalidating current refs | Manual retry worker at launch. |

## 11. User controls and factual safeguards

- Self-service: profile update/avatar upload, password reset/verification flows, course/payment/order visibility, payment-proof replacement while pending, quiz-draft removal on account deletion, account deletion after current-password confirmation, feedback publication consent/withdrawal, unsubscribe link, contact form.
- Admin-only: user status/course access, payment review/holds, payment methods, campaigns, contact inbox, feedback moderation, audit logs and reports. Backend routes generally use `validateToken` then `requireAdmin` ([routes](../apps/Backend/routes)).
- No dedicated account-data export or formal privacy/correction/deletion-request workflow was found. Contact email is visible publicly, but source does not implement a formal request process.
- Factual controls: bcrypt password handling, JWT/session-version checks, refresh token hashing/rotation, exact-origin credentialed CORS, Helmet/CSP/HSTS production configuration, rate limits (global/contact/feedback), image MIME/signature/5 MB checks, trusted URL validation, error/log redaction, and server-side proof access controls. These are controls, not a guarantee of security.

## 12. Existing legal/privacy UI and children

- Footer links route to `/privacy-policy` and `/cookie-policy`. Both pages explicitly state they are basic shells and that approved wording has **not** been published ([LegalPolicy](../apps/Frontend/src/pages/LegalPolicy.jsx)). No Terms/Terms & Conditions route or content was found.
- The current Privacy/Cookie shells include `arunthaiedu@gmail.com` for questions. They do not yet describe the implemented data flows/retention above; this is a **BLOCKER BEFORE POLICY DRAFT** only in the sense that approved text is absent, not a request to change code in this audit.
- No age/date-of-birth field, age gate/minimum age, parental-consent flow, child-account role, child-targeting configuration, or age-related Privacy/Terms wording was found.

## 13. Business/controller and hosting facts

### Verified from repository

- Product: Arun Thai / Arun Thai Language Center; domain: `arunthaiedu.com`; public contact email: `arunthaiedu@gmail.com`; Facebook contact link above.
- Backend uses `MONGO_DB`, Cloudinary environment credentials and Resend `RESEND_API_KEY`/`EMAIL_FROM`; values are not reproduced here.
- Owner-provided launch context recorded in [runbook](retention-operations.md): Render Free, MongoDB Atlas Free, manual retention, no automated schedule.

### Cannot be verified from repository

Legal entity/trading name, operator identity, physical address, country of establishment, company/registration number, privacy-specific contact, phone, actual production host/database, Render/Atlas/Cloudinary/Resend regions, backups/PITR, provider contracts/DPAs, subprocessors, cross-border safeguards, actual deployment branch, or production logging retention.

## 14. Gaps and inconsistencies

| Severity | Finding |
| --- | --- |
| BLOCKER BEFORE POLICY DRAFT | Privacy and Cookie routes are placeholders; no Terms route/content. Owner/legal drafting inputs below are missing. |
| SHOULD FIX BEFORE LAUNCH | Product naming is inconsistent: public Arun Thai vs `english_kafe` Cloudinary folders/database/test terminology. Decide the customer-facing/controller name and whether legacy technical names need explanation. |
| SHOULD FIX BEFORE LAUNCH | No source-established age/child position, jurisdiction, business/controller identity, address, or privacy-request channel/process. These are required owner/legal inputs, not code assumptions. |
| DOCUMENT/EXPLAIN | Contact form sends no transactional enquiry confirmation unless someone explicitly opts into marketing; confirmed marketing opt-in sends a Resend confirmation. |
| DOCUMENT/EXPLAIN | Payment snapshots can retain recipient/account details up to the 12-month minimization point; Payment retains linkable `userId` for seven years. |
| DOCUMENT/EXPLAIN | Refresh cookies and local quiz drafts exist; no analytics/ad tracking found in source. |
| OPTIONAL CLEANUP | Legacy `rejectReason` remains alongside structured reason/note for compatibility. |
| OPTIONAL CLEANUP | Admin `normalizeUser` still exposes a `marketingOptIn` Boolean derived from an input property although persisted ContactLead consent is now `marketingConsent`; determine whether this legacy presentation field is meaningful. |

## 15. Information still required from owner

1. Legal entity/controller name, country/jurisdictions served/targeted, address, registration details and authoritative privacy contact.
2. Whether/where services are intended for minors, applicable age rule and parental-consent process.
3. Approved channels/processes for privacy access, correction, objection, deletion and portability/export requests.
4. Whether the stated contact email is the designated privacy contact and expected response process.
5. Actual production providers/regions, hosting/database backup/recovery posture, processor contracts and cross-border arrangements.
6. Intended legal basis/marketing-consent approach, cookie/electronic-marketing position and financial-record retention justification — for legal research, not inferred from code.
7. Whether public testimonial consent wording and public use of first name/avatar match owner intent.
8. Final decision on Arun Thai versus English Kafe legacy identifiers and any business-name disclosure.

## 16. Legal-research questions (not conclusions)

- Which jurisdiction(s) and Thai PDPA notice disclosures apply to the operator/audience?
- What lawful-basis and consent records are needed for account processing, marketing, testimonials and payment review?
- What child/minor rules apply, if any?
- What cross-border transfer, provider, DPA/subprocessor disclosures are needed for MongoDB/Cloudinary/Resend/Render/Facebook/Unsplash?
- What data-subject rights, identity verification and response workflow must be offered?
- What cookie/electronic-marketing rules apply to authentication cookies, local quiz drafts and optional marketing email?
- What justification/documentation is needed for seven-year financial retention, proof minimization and independent audit TTLs?

## 17. Material source references

Backend: `models/userModel.js`, `paymentModel.js`, `contactLeadModel.js`, `contactEnquiryModel.js`, `studentFeedbackModel.js`, `auditLogModel.js`, `enrollmentModel.js`; `controllers/contactController.js`, `paymentController.js`, `studentFeedbackController.js`, `testimonialController.js`, `userController.js`; `services/studentAccountDeletion.js`, `paymentProofRetention.js`, `paymentSnapshotMinimization.js`, `paymentFinalRetention.js`, `campaignLifecycle.js`, `sessionService.js`, `auditLogger.js`; `server.js`, `middleware/uploadValidation.js`, `middleware/authMiddleware.js`, `middleware/adminMiddleware.js`.

Frontend/Admin: `Frontend/index.html`, `src/components/Seo.jsx`, `ContactSection.jsx`, `Footer.jsx`, `pages/LegalPolicy.jsx`, `pages/MyProfile.jsx`, `pages/Quiz.jsx`, `api/tokenStorage.js`, `config/contactLinks.js`; `Admin/index.html`, `src/main.jsx`, `src/pages/AdminLogin.jsx`, contact/campaign/payment/feedback management pages. Retention operations: [runbook](retention-operations.md).
