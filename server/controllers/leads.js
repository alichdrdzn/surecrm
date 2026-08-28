import mongoose from "mongoose";
import Lead from "../model/Lead.js";
import Notes from "../model/Notes.js";
import Calls from "../model/Calls.js";
import Meetings from "../model/Meetings.js";
import Tasks from "../model/Tasks.js";
import Emails from "../model/emails.js";
import { crm } from "../utils/logger.js";
import csvParser from 'csv-parser';
import fs from 'fs';

const index = async (req, res) => {
  const query = req.query
  query.deleted = false;
  let allData = await Lead.find(query).populate({
    path: 'createdBy',
    match: { deleted: false } // Populate only if createBy.deleted is false
  }).exec()

  const result = allData.filter(item => item.createdBy !== null);

  let totalRecords = result.length
  
  res.send({ result, total_recodes: totalRecords })
}

const add = async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json({ lead, message: 'Lead saved successfully' });
  } catch (err) {
    crm.error('Failed to create Lead:', err);
    res.status(500).json({ error: 'Failed to create Lead' });
  }
}

const edit = async (req, res) => {
  try {

    let result = await Lead.findByIdAndUpdate(
      { _id: req.params.id },
      { $set: req.body }
    );
    res.status(200).json({ result, message: 'Lead updated successfully' });
  } catch (err) {
    crm.error('Failed to Update Lead:', err);
    res.status(400).json({ error: 'Failed to Update Lead' });
  }
}

const view = async (req, res) => {
  try {
    let leads = await Lead.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(req.params.id),
        },
      },

      {
        $lookup: {
          from: "notes",
          localField: "_id",
          foreignField: "lead_id",
          as: "notes",
          pipeline: [
            {
              $match: {
                deleted: false, 
              },
            },
          ],
        },
      },

      {
        $lookup: {
          from: "calls",
          localField: "_id",
          foreignField: "lead_id",
          as: "calls",
          pipeline: [
            {
              $match: {
                deleted: false, 
              },
            },
          ],
        },
      },

      {
        $lookup: {
          from: "meetings",
          localField: "_id",
          foreignField: "lead_id",
          as: "meetings",
          pipeline: [
            {
              $match: {
                deleted: false,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "emails",
          localField: "_id",
          foreignField: "lead_id",
          as: "emails",
          pipeline: [
            {
              $match: {
                deleted: false, 
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "tasks",
          localField: "_id",
          foreignField: "lead_id",
          as: "tasks",
          pipeline: [
            {
              $match: {
                deleted: false, 
              },
            },
          ],
        },
      },
    ]);

    if (leads.length === 0) {
      return res.status(404).json({ message: "No data found." });
    }


    let lead = leads[0];
    let populatedLead = await Lead.populate(lead, { path: "assigned_agent", select: ["firstName", "lastName"] });
    res.status(200).json({ lead: populatedLead });
  } catch (error) {
    crm.error(error);
    res.status(500).json({ message: "Internal Server Error." });
  }
};


const deleteData = async (req, res) => {
  try {
    const leadId = req.params.id;

    // Delete notes related to the lead
    await Notes.updateMany({ lead_id: leadId, deleted: true });

    // Delete calls related to the lead
    await Calls.updateMany({ lead_id: leadId, deleted: true });

    // Delete meetings related to the lead
    await Meetings.updateMany({ lead_id: leadId, deleted: true });

    // Delete emails related to the lead
    await Emails.updateMany({ lead_id: leadId, deleted: true });

    // Delete tasks related to the lead
    await Tasks.updateMany({ lead_id: leadId, deleted: true });

    // Delete the lead itself
    const deletedLead = await Lead.findByIdAndUpdate(leadId, { deleted: true });

    if (!deletedLead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    res.status(200).json({ message: "Lead and related data deleted successfully." });
  } catch (error) {
    crm.error(error);
    res.status(500).json({ message: "Internal Server Error." });
  }
};


const deleteMany = async (req, res) => {
  try {
    const leadIds = req.body;

    // Delete notes related to the leads
    await Notes.updateMany({ lead_id: { $in: leadIds } }, { $set: { deleted: true } });

    // Delete calls related to the leads
    await Calls.updateMany({ lead_id: { $in: leadIds } }, { $set: { deleted: true } });

    // Delete meetings related to the leads
    await Meetings.updateMany({ lead_id: { $in: leadIds } }, { $set: { deleted: true } });

    // Delete emails related to the leads
    await Emails.updateMany({ lead_id: { $in: leadIds } }, { $set: { deleted: true } });

    // Delete tasks related to the leads
    await Tasks.updateMany({ lead_id: { $in: leadIds } }, { $set: { deleted: true } });

    // Delete the leads themselves
    const deletedLeads = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: { deleted: true } });

    if (deletedLeads.deletedCount === 0) {
      return res.status(404).json({ message: "No leads found." });
    }

    res.status(200).json({ message: "Leads and related data deleted successfully." });
  } catch (error) {
    crm.error(error);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

// Map CSV headers to Lead model fields
const leadFieldMapping = {
    'title': 'title',
    'first_name': 'firstName',
    'firstname': 'firstName',
    'first name': 'firstName',
    'last_name': 'lastName',
    'lastname': 'lastName',
    'last name': 'lastName',
    'date_of_birth': 'dateOfBirth',
    'dateofbirth': 'dateOfBirth',
    'date of birth': 'dateOfBirth',
    'gender': 'gender',
    'phone_number': 'phoneNumber',
    'phonenumber': 'phoneNumber',
    'phone number': 'phoneNumber',
    'email_address': 'emailAddress',
    'emailaddress': 'emailAddress',
    'email address': 'emailAddress',
    'email': 'emailAddress',
    'address': 'address',
    'lead_source': 'leadSource',
    'leadsource': 'leadSource',
    'lead source': 'leadSource',
    'lead_status': 'leadStatus',
    'leadstatus': 'leadStatus',
    'lead status': 'leadStatus',
    'lead_score': 'leadScore',
    'leadscore': 'leadScore',
    'lead score': 'leadScore',
    'alternate_phone_number': 'alternatePhoneNumber',
    'alternatephonenumber': 'alternatePhoneNumber',
    'alternate phone number': 'alternatePhoneNumber',
    'additional_email_address': 'additionalEmailAddress',
    'additionalemailaddress': 'additionalEmailAddress',
    'additional email address': 'additionalEmailAddress',
    'instagram_profile': 'instagramProfile',
    'instagramprofile': 'instagramProfile',
    'instagram profile': 'instagramProfile',
    'twitter_profile': 'twitterProfile',
    'twitterprofile': 'twitterProfile',
    'twitter profile': 'twitterProfile',
    'type_of_insurance': 'typeOfInsurance',
    'typeofinsurance': 'typeOfInsurance',
    'type of insurance': 'typeOfInsurance',
    'desired_coverage_amount': 'desiredCoverageAmount',
    'desiredcoverageamount': 'desiredCoverageAmount',
    'desired coverage amount': 'desiredCoverageAmount',
    'specific_policy_features': 'specificPolicyFeatures',
    'specificpolicyfeatures': 'specificPolicyFeatures',
    'specific policy features': 'specificPolicyFeatures',
    'qualification_status': 'QualificationStatus',
    'qualificationstatus': 'QualificationStatus',
    'qualification status': 'QualificationStatus',
    'policy_type': 'policyType',
    'policytype': 'policyType',
    'policy type': 'policyType',
    'policy_number': 'policyNumber',
    'policynumber': 'policyNumber',
    'policy number': 'policyNumber',
    'start_date': 'startDate',
    'startdate': 'startDate',
    'start date': 'startDate',
    'end_date': 'endDate',
    'enddate': 'endDate',
    'end date': 'endDate',
    'coverage_amount': 'coverageAmount',
    'coverageamount': 'coverageAmount',
    'coverage amount': 'coverageAmount',
    'term_length': 'termLength',
    'termlength': 'termLength',
    'term length': 'termLength',
    'conversion_reason': 'conversionReason',
    'conversionreason': 'conversionReason',
    'conversion reason': 'conversionReason',
    'conversion_date_time': 'conversionDateTime',
    'conversiondatetime': 'conversionDateTime',
    'conversion date time': 'conversionDateTime',
    'lead_category': 'leadCategory',
    'leadcategory': 'leadCategory',
    'lead category': 'leadCategory',
    'lead_priority': 'leadPriority',
    'leadpriority': 'leadPriority',
    'lead priority': 'leadPriority',
    'assigned_agent': 'assigned_agent',
    'assignedagent': 'assigned_agent',
    'assigned agent': 'assigned_agent',
};

const importCSV = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const results = [];
    let skipped = 0;
    const createdBy = req.body.createdBy || req.user?._id || '0';
    const assignedAgent = req.body.assigned_agent || createdBy;

    try {
        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csvParser({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
                .on('data', (row) => {
                    const leadData = {};
                    let hasValidData = false;

                    for (const [csvKey, value] of Object.entries(row)) {
                        const mappedKey = leadFieldMapping[csvKey.toLowerCase()];
                        if (mappedKey && value && value.trim()) {
                            leadData[mappedKey] = value.trim();
                            hasValidData = true;
                        }
                    }

                    if (hasValidData) {
                        leadData.createdBy = createdBy;
                        leadData.deleted = false;
                        results.push(leadData);
                    } else {
                        skipped++;
                    }
                })
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });

        if (results.length > 0) {
            await Lead.insertMany(results, { ordered: false }).catch((err) => {
                crm.error('Some leads failed to insert:', err.message);
            });
        }

        fs.unlink(req.file.path, (err) => {
            if (err) crm.error('Error deleting temp file:', err);
        });

        res.status(200).json({
            message: `Import completed. ${results.length} leads created, ${skipped} rows skipped.`,
            imported: results.length,
            skipped: skipped,
        });
    } catch (error) {
        crm.error('CSV import error:', error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ message: 'Failed to import CSV: ' + error.message });
    }
};

export default { index, add, edit, view, deleteData, deleteMany, importCSV };
