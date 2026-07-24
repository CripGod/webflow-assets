# UI Generator legal implementation copy

**Version:** 2026-07-23  
**Prepared:** July 23, 2026  
**Operator used in this draft:** PatternBreak  
**Privacy and legal contact used in this draft:** chevon@patternbreak.com

> **Internal launch note:** This is a practical v1 drafted for the current UI Generator product and registration flow. Before publishing, confirm PatternBreak's exact legal entity name or suffix, confirm that chevon@patternbreak.com is the desired public contact, and verify the live hosting, authentication, storage, analytics, email, and error-monitoring vendors named or described in the Privacy Policy. A qualified attorney should review the documents before major scale, a marketplace launch, team/classroom accounts, or material changes to data practices.

## 1. Account sign-up

### Required consent checkbox

**Checkbox label:**

> I agree to the [Terms of Use](/terms) and acknowledge the [Privacy Policy](/privacy).

The checkbox should be unchecked by default and required before account creation.

**Eligibility note, displayed near sign-up but outside the checkbox:**

> Accounts are for users age 13 and older. If you have not reached the age of majority where you live, a parent or legal guardian must agree to the Terms on your behalf.

**Age-screening implementation note:** The eligibility statement is contractual, not a verified age screen. If UI Generator asks for age or date of birth, collect it neutrally before other registration data and prevent an under-13 user's account creation or personal-information submission unless a COPPA-compliant parental-consent flow is implemented. Do not use a simple “I am 13+” checkbox as the only age-screening mechanism.

### Privacy notice at collection

Place this immediately below the email/account fields or directly below the required checkbox:

> PatternBreak collects your email, account identifiers, device and security data, and any projects you choose to save in order to create and secure your account, provide cloud saves and plan entitlements, support you, and improve UI Generator. Local-only projects remain in your browser unless you choose to save or publish them. We do not sell personal information or share it for cross-context behavioral advertising. Learn more in the [Privacy Policy](/privacy).

### Optional marketing checkbox

Keep this separate, optional, and unchecked by default:

> Send me occasional product updates, new kit releases, tutorials, and offers.

Do not make marketing consent a condition of creating an account or buying a subscription.

## 2. Paid checkout and automatic renewal

The renewal disclosure must be visually close to the purchase button and separate from general Terms acceptance.

### Founding Individual checkout copy

**Plan label:** Founding Individual  
**Price line:** $29.99 per year, plus applicable tax

**Renewal disclosure:**

> You will be charged $29.99 today, plus applicable tax. This subscription renews automatically every 12 months at the then-current annual price unless you cancel. Cancel anytime online in Account > Billing; cancellation stops the next charge, and paid access continues through the end of the current term. We will email you a renewal reminder before the annual renewal date.

**Required renewal authorization checkbox:**

> I authorize PatternBreak to charge $29.99 today and automatically each year unless I cancel, and I agree to the subscription terms above.

**Purchase button:**

> Start annual membership - $29.99

### Student checkout copy

**Plan label:** Student  
**Price line:** $15.99 per year, plus applicable tax

**Renewal disclosure:**

> You will be charged $15.99 today, plus applicable tax. This subscription renews automatically every 12 months at the then-current annual price unless you cancel. Cancel anytime online in Account > Billing; cancellation stops the next charge, and paid access continues through the end of the current term. We will email you a renewal reminder before the annual renewal date. Student eligibility may be reverified before renewal.

**Required renewal authorization checkbox:**

> I authorize PatternBreak to charge $15.99 today and automatically each year unless I cancel, and I agree to the subscription terms above.

**Purchase button:**

> Start student membership - $15.99

### Pricing note

If Founding Individual pricing is intended to remain permanently locked for that customer, replace "at the then-current annual price" with:

> at your locked founding rate of $29.99 per year

Do not use the locked-rate version unless PatternBreak intends to honor that promise for the life of the subscription.

## 3. Purchase confirmation email

**Subject:** Your UI Generator annual membership is active

**Body:**

> Thanks for joining UI Generator. Your **[Plan Name]** membership is now active.  
>  
> Amount charged: **[Amount] plus applicable tax**  
> Billing period: **Annual**  
> Next renewal date: **[Date]**  
>  
> Your membership will renew automatically on the date above at the then-current annual price unless you cancel. You can manage or cancel your subscription at any time in **Account > Billing**: [Manage Subscription]. Cancellation stops the next renewal charge and does not end access early.  
>  
> [Terms of Use] | [Privacy Policy] | [Contact Support]

The confirmation must be capable of being retained by the customer.

### Fee-change notice, when applicable

Send this no fewer than 7 days and no more than 30 days before a changed subscription fee takes effect:

**Subject:** Your UI Generator membership price is changing

**Body:**

> Beginning with your renewal on **[Date]**, the annual price of your **[Plan Name]** membership will change from **[Old Amount]** to **[New Amount] plus applicable tax**. Unless you cancel before the renewal date, your saved payment method will be charged the new amount automatically.  
>  
> Manage or cancel online: [Manage Subscription]  
>  
> [Terms of Use] | [Privacy Policy] | [Contact Support]

## 4. Annual renewal reminder

Send this between 15 and 45 days before an annual renewal.

**Subject:** Your UI Generator membership renews on [Date]

**Body:**

> Your **[Plan Name]** membership is scheduled to renew on **[Date]** for **[Amount] plus applicable tax**. Unless you cancel before that date, your saved payment method will be charged automatically.  
>  
> Manage or cancel online: [Manage Subscription]  
>  
> Cancellation stops the upcoming charge and leaves your paid access active through the end of the current term.  
>  
> [Terms of Use] | [Privacy Policy] | [Contact Support]

## 5. Cancellation interface

Place a prominent button in **Account > Billing**:

> Cancel automatic renewal

Confirmation dialog:

> **Cancel automatic renewal?**  
> You will not be charged again. Your paid features will remain available through **[Paid Through Date]**, after which your account will move to the Free plan. Your locally stored projects will remain in your browser. Cloud projects will be handled according to the Terms of Use and Privacy Policy.

Primary action:

> Confirm cancellation

Secondary action:

> Keep membership

Confirmation state:

> Automatic renewal is canceled. Your paid access remains active through **[Paid Through Date]**.

Do not require a phone call, support chat, survey completion, or retention offer before cancellation can be completed.

## 6. Footer links

Use these on every public page and inside the signed-in application:

- Terms of Use -> `/terms`
- Privacy Policy -> `/privacy`
- Contact -> the current support/contact route or `mailto:chevon@patternbreak.com`
- Cookie Settings -> only if nonessential cookies or analytics controls are implemented

A "Do Not Sell or Share My Personal Information" footer link is not necessary while PatternBreak does not sell personal information or share it for cross-context behavioral advertising. Add the link and supporting workflow before any such practice begins.

## 7. Consent and version records

Store at minimum:

- User/account identifier
- Terms version: `2026-07-23`
- Privacy version: `2026-07-23`
- Terms/privacy acceptance timestamp
- Sign-up source or interface version
- Subscription-offer version
- Renewal-consent timestamp
- Plan, price, currency, and billing interval shown at consent
- Payment processor customer/subscription identifiers
- Cancellation timestamp and effective paid-through date

Maintain automatic-renewal consent records for at least three years, or one year after the subscription ends, whichever is longer. Keep each published Terms and Privacy version available internally so the accepted text can be reconstructed.

## 8. Launch verification

Before turning registration on, verify that:

1. `/terms` and `/privacy` resolve publicly without authentication.
2. The sign-up checkbox is unchecked and required.
3. Terms and Privacy version acceptance is written to the account record.
4. The annual-renewal disclosure appears before payment confirmation.
5. Renewal authorization is affirmative and separately recorded.
6. The confirmation email contains the price, renewal term, cancellation policy, and direct cancellation path.
7. Annual reminders are scheduled 15-45 days before renewal.
8. Online cancellation works without contacting support.
9. Account deletion and privacy-request workflows have a real destination.
10. Local-only, cloud-saved, and public projects behave exactly as the policies describe.
11. If age or date of birth is collected, the age screen is neutral and under-13 data collection is blocked unless a compliant parental-consent flow exists.
12. A registered user under 18 can remove their own public content or send a working **Minor Content Removal** request.
13. If subscription pricing changes, a fee-change notice is scheduled 7-30 days before the new fee takes effect.
