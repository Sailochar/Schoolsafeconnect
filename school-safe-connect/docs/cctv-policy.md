# School Safe Connect (SSC) - Live CCTV Access & Privacy Policy

## 1. Live-Only Architecture
1. **No Recording / No Storage**: The School Safe Connect platform does not record, buffer, archive, or permit recording of CCTV camera feeds.
2. **Ephemeral Stream Tokens**: Feeds are accessed exclusively through short-lived cryptographic tokens valid for 5 to 10 minutes.
3. **No Private Zones**: Cameras are strictly prohibited in washrooms, medical rooms, staff rooms, or changing facilities. Any camera flagged with `privacyZone: true` is permanently barred from streaming.

## 2. Parent CCTV Access Eligibility Checklist
A parent can view CCTV only if ALL 12 conditions evaluate to true:
1. Parent user account is `ACTIVE`.
2. Parent verification status is `VERIFIED` by School Admin.
3. Parent is linked to a verified enrolled student (`ParentStudentLink`).
4. Linked student belongs to the requested class.
5. School Admin enabled CCTV feature globally for the school tenant.
6. Designated Class Teacher approved the parent's CCTV request for that date.
7. Requested camera belongs to that class.
8. Current day matches configured class schedule (`Class.cctvAccess.days`).
9. Current time is within class timing window (`startTime` - `endTime`).
10. Parent has not exceeded daily session limit (e.g. max 5 sessions per day).
11. Cooldown period completed between sessions (e.g. 15 minutes).
12. One active CCTV stream session per parent.

## 3. Dynamic Forensic Watermarking
Every video stream renders a semi-transparent, readable overlay containing:
- School Code: `SSC-SCH-XXXX`
- Parent Name: `[Parent Full Name]`
- Child Name: `[Child Full Name]`
- Class: `[Class - Section]`
- Parent User Code: `SSC-SCH-XXXX-PAR-XXX`
- Student Code: `SSC-SCH-XXXX-STU-XXX`
- Session Identifier: `[Unique Session ID]`
- Timestamp: `DD-MMM-YYYY HH:mm:ss IST`
- Camera Identifier: `SSC-SCH-XXXX-CAM-XXX`

The watermark position shifts every 5 to 10 seconds to eliminate cropping vectors.
Unauthorized screen capture or distribution is strictly prohibited and immediately traceable.
