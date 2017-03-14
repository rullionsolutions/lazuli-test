/* global module, require */

"use strict";

var Test = require("lazuli-test/Test.js");

module.exports = Test.clone({
    id: "UnitTests",
    ignore_errors: true,
});

module.exports.override("sub_test", [
    {
        id: "UnitTestCore",
        path: "lapis-core/test/UnitTestCore.js",
        funct: "coreTest",
        show_structure: false,
        full_path: true,
    },
    {
        id: "UnitTestPage",
        path: "lazuli-ui/test/UnitTestPage.js",
        funct: "coreTest",
        show_structure: false,
        full_path: true,
    },
    {
        id: "UnitTestSQL",
        path: "lazuli-sql/test/UnitTestSQL.js",
        funct: "coreTest",
        show_structure: false,
        full_path: true,
    },
    {
        id: "UnitTestTransaction",
        path: "lazuli-data/test/UnitTestTransaction.js",
        funct: "coreTest",
        show_structure: false,
        full_path: true,
    },
]);

// module.exports.override("test", function () {
//     this.runSubTest("UnitTestCore"  , "core/test/UnitTestCore.js"); // moved from core/base/test.js
//     this.runSubTest("UnitTestPage"  , "core/test/UnitTestPage.js"); // moved from core/page/test.js
//     this.runSubTest("UnitTestSQL"   , "core/test/UnitTestSQL.js");  // moved from core/sql/test.js
//   /* this.runSubTest("UnitTestTrans" , "core/test/UnitTestTrans.js");    // moved from core/trans/test1.js && test2.js*/
//     this.runSubTest("UnitTestTransaction", "core/test/UnitTestTransaction.js");
//     this.runSubTest("UnitTestDates", "core/test/UnitTestDates.js");
// });
