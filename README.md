# lazuli-test
The whole test can be calling  `x.Test.run({x: x, ...options})` from Rhino shell or calling `./rhino.sh test_new.js` from command line.
If you need to run the old `R6` test you can call `./rhino.sh test.js` from command line.
To run specific steps:
* Backup database after each step using option dump_before_each_area: true, e.g. `x.Test.run({ dump_before_each_area: true });`
* Start test from certain step on ModuleTest using option restart_at_area: module, e.g. `x.Test.run({ restart_at_area: 'vc' });`
* Restore database from earlier backup using restore_from_area: module, e.g. `x.Test.run({ restore_from_area: 'vc' });`
* Run specific module and populate db from corresponding backup using module: module, e.g. `x.Test.run({ module: 'vc' });`
* Run only unit tests using type: 'unit', e.g. `x.Test.run({ type: 'unit' });`
* Run only page tests using type: 'page', e.g. `x.Test.run({ type: 'page' });`

Unit tests include the core tests and the entity level tests, so if you want to run certain entity level unit test, you can use
one of the following commands:
* Run one exact unit test x.Test.testCoverage(entity, function), e.g. `x.Test.testCoverage('vc_offer', 'checkExcessTerms');`
* Run multiple unit tests under entity x.Test.testCoverage(entity, [funct1, funct2]), e.g. `x.Test.testCoverage('vc_offer', ['addSecurityCondition', 'checkExcessTerms']);`
* Run all units under given entity x.Test.testCoverage(entity), e.g. `x.Test.testCoverage('vc_offer');`
* Run tests for multiple entities x.Test.testCoverage([entity1, entity2]), e.g. `x.Test.testCoverage(['vc_offer', 'vc_sbm']);`

It's also possible to print the structure of the test including every step and assertion on test under ModuleTests by
calling `x.Test.showStructure();` which prints something like
```
Test Test:
    Test ModuleTests:
        Test ad:
        Test rm:
        Test vr:
        Test vc:
            Test vc_sbm: Submission tests
                Test vc_sbm_1: Create perm agency candidate
                         Assert status: Submission status is Submitted ('S')
                         Assert email: Resource email equals submission email
                         Assert ni_number: Resource NiNumber equals submission NiNumber
                Test vc_sbm_2: Review Submission
                         Assert status: Submission status is Under Consideration ('C')
                Test vc_sbm_3: Review Reject Submission
                         Assert status: Submission status is Rejected ('R')
                         Assert reject_ntfcn: Reject notification is 'Notified by Agency' (A)
                Test vc_sbm_4: Withdraw Submission
                         Assert status: Submission status is Withdrawn ('W')
                Test vc_sbm_5: Reject reviewed Submission
                         Assert status: Submission status is Rejected ('R')
                         Assert reject_ntfcn: Reject notification is 'Notified by Agency' (A)
                Test vc_sbm_6: Unavailable Submission
                         Assert status: Submission status is Unavailable ('U')
                Test vc_sbm_7: Self-Service Perm Submission
                         Assert status: Submission status is Under Consideration ('C')
                         Assert home_user_id: Candidate has home user record
                Test vc_sbm_8: Agency Contractror Submission
                         Assert status: Submission status is Under Consideration ('C')
            Test vc_ivw: Interview tests
                Test vc_ivw_1: Create Interview
                         Assert status: Interview status is Invited ('I')
                         Assert interest_level: Submission Interest Level is 2
                         Assert first_interview: Submissions first interview is not blank
                Test vc_ivw_2: Cancel Interview
                         Assert status: Interview status is Cancelled ('X')
                Test vc_ivw_3: Schedule Interview
                         Assert status: Interview status is Scheduled ('S')
                Test vc_ivw_4: Re-Schedule Interview
                         Assert status: Interview status is Scheduled ('I')
                Test vc_ivw_4: Interview Record Results
                         Assert status: Interview status is Completed ('C')
                Test vc_ivw_6: Create Self-Service Interview
                         Assert status: Interview status is Invited ('I')
            Test vc_offer: Offer Tests
                Test vc_offer_1: Create some offer
                         Assert status: Offer status is Unapproved ('E')
                         Assert status2: Status is Offered ('P') after auto node
                         Assert sbm_status: Submission status is Offer ('O')
                         Assert sbm_interest_level: Submission interest level is 3
                Test vc_offer_2: Offer Tests
                         Assert status: Offer status is Cancelled ('C')
                         Assert sbm_status: Submissions status is Under Consideration ('C')
                Test vc_offer_3: Perm Decline offer
                         Assert status: Offer status is Declined ('D')
                         Assert sbm_status: Submission status is Under Consideration ('C')
                Test vc_offer_4: Perm Approve and Auto Show
                         Assert status: Offer status is Accepted ('A')
                         Assert status_after: Offer status is Show ('S')
                         Assert sbm_status: Submission status is Show ('H')
                Test vc_offer_5: Perm No Show after Show
                         Assert status: Offer status is No Show ('N')
                         Assert sbm_status: Submission status is No Show ('Z')
                Test vc_offer_6: ASW show
                         Assert status: Offer status is Show ('S')
                         Assert sbm_status: Submission status is Show ('H')
        Test ts:
        Test sv:
```
