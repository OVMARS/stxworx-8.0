# Milestone Resubmission Feature

## Summary
Added the ability for freelancers to resubmit rejected milestones.

## Backend Changes
- Updated `milestoneController.submit` to check for existing submissions
- If a rejected submission exists, it updates it instead of creating a new one
- Added proper validation to only allow resubmission for rejected milestones
- Notification is sent to client with "Resubmitted" title

## Frontend Changes
- Added "Resubmit Work" button for rejected milestones (orange color)
- Updated `MilestoneSubmitModal` to handle resubmissions:
  - Dynamic title: "Submit" vs "Resubmit"
  - Warning message for resubmissions
  - Button text changes accordingly

## How it Works
1. Client rejects a milestone submission
2. Freelancer sees "Resubmit Work" button (orange) on dashboard
3. Clicking opens the modal with resubmission messaging
4. Freelancer submits updated work
5. Client receives notification about resubmission
6. Cycle continues until approved

## Test Steps
1. Create a project with milestones
2. Submit milestone work
3. Client rejects the milestone
4. Freelancer should see "Resubmit Work" button
5. Resubmit with updated work
6. Client should receive notification and be able to review again
