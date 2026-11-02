# Family Circle & Parental Controls

Product purpose, goals, and feature scope for CribsTalk Family Circle (`FamilyCircleAccounts`).

---

## Purpose and goals

| Critical area | Purpose | Goal |
| --- | --- | --- |
| **Child Safety & Protection** | Protect young users from cyberbullying, harassment, scams, and inappropriate content. | Allow parents to monitor safety-related activities without invading every aspect of a child’s privacy. Create a safer online environment than traditional social media platforms. |
| **Age-Appropriate Experiences** | Enable/activate different features based on age groups: Children (under 13), Teens (13–17), Adults (18+). | Encourage healthy social media habits with role-appropriate defaults (child / teen / parent). |
| **Digital Well-Being** | Allow parents to set daily screen-time limits; schedule study, sleep, or family time; and view usage summaries. | Encourage healthy social media habits through limits, schedules, and transparent usage summaries (counts only — no private message content). |
| **Family Engagement** | Create/set parent–child connections within CribsTalk. | Allow parents to approve friend requests for younger users, receive alerts about safety concerns, and view educational opportunities their children discover. |
| **Youth Opportunity Protection** | Support CribsTalk focus areas: education, mentorship, and opportunities — with verification & approval. | Verify scholarship applications; monitor mentorship connections; approve participation in youth events and programs; receive notifications when children join educational groups. |

---

## Feature Scope (Family Dashboard)

### Family Dashboard

Parents can view:

- Child’s account status
- Screen time
- Friends count
- Communities joined
- Safety alerts
- Recent achievements

### Parental Permissions

Parents can:

- Approve new contacts
- Approve direct messaging
- Control profile visibility
- Set time limits
- Restrict content categories
- Lock account during school hours (allowed window + bedtime / study schedules)

### Family Safety Alerts

Notifications for:

- Suspected bullying
- Repeated reports against an account
- Stranger contact requests
- Suspicious links
- Account security issues
- Excessive daily usage

---

## Implementation notes (branch)

| Scope item | Status on `FamilyCircleAccounts` |
| --- | --- |
| Family create / invite / child–teen roles | Implemented |
| Friend-request approval | Implemented |
| Messaging / calling / groups / marketplace toggles | Implemented |
| Screen-time limits, allowed window, bedtime | Implemented |
| Activity summaries (counts only) | Implemented |
| Safety alerts pipeline + parent notifications | Implemented (types expanded for links & excessive usage) |
| Profile visibility + content filter controls | UI wired to existing `parental_controls` fields |
| Family Dashboard summary cards | Parent member overview shows status, screen time, friends/communities activity, alerts |
| Recent achievements | Planned — surface when youth achievement events exist |
| Scholarship / mentorship / event approval | Planned — Youth Opportunity Protection |
| Educational group join notifications | Partial — group join is gated + counted; dedicated education-group alerts planned |
