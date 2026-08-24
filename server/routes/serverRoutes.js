import express from "express";
const router = express.Router();

import LeadRoute from "./leadRoutes.js";
import ContactRoute from "./contactRoutes.js"
import ClaimRoute from './claimRoutes.js'
import NoteRoute from "./noteRoutes.js"
import CallRoute from "./callRoutes.js";
import MeetingRoute from "./meetingRoutes.js"
import EmailRoute from './EmailRoutes.js'
import TaskRoute from "./taskRoutes.js"
import UserRoute from "./userRoutes.js"
import PolicyRoute from "./policyRoutes.js"
import DocumentRoute from './documentRoutes.js'
import PolicyDocumentRoute from './policyDocumentRoutes.js'
import emailTemmplateRoute from './emailTemplateRoutes.js'

router.use('/lead', LeadRoute);
router.use('/contact', ContactRoute);
router.use('/claim', ClaimRoute);
router.use('/note', NoteRoute);
router.use('/call', CallRoute)
router.use('/meeting', MeetingRoute)
router.use('/email', EmailRoute)
router.use('/task', TaskRoute)
router.use('/user', UserRoute)
router.use('/policy', PolicyRoute)
router.use('/document', DocumentRoute)
router.use('/policydocument', PolicyDocumentRoute)
router.use('/emailtemplate', emailTemmplateRoute)

export default router;
