/* global Packages */

"use strict";

var Core = require("lapis-core/index.js");


module.exports = Core.Base.clone({
    id: "Test",
    break_on_fail: true,
    hide_asserts: false,
    failed_asserts: 0,
    passed_asserts: 0,
    failed_cumultv: 0,
    passed_cumultv: 0,
    tests: {},
    level: 0,
    response_writer: {
        lines: [],
        text: "",
        print: function (str) {
            this.text += str;
            if (str !== "\n") {
                this.lines.push(str);
            }
        },
        getLine: function (id) {
            return this.lines[id];
        },
        length: function () {
            return this.lines.length;
        },
    },
});

// x.test = {};

module.exports.register("preTest");
module.exports.register("postAssert");


// scope is a container for all transient data (i.e. set during test run)
module.exports.define("run", function (options) {
    // x.tests = {};
    this.addProperties(options);
    this.clearStartDates();
    this.runFromParent();
    this.reportResult();
    this.closeSessions();
});

module.exports.define("clearStartDates", function () {
    // this.tests.forOwn(function (test_id, test) {
    //     delete test.start_date;
    // });
});

module.exports.define("getParams", function (param_key, overrides) {
    var params = {};
    var default_params;
    var that = this;
    if (Object.keys(this.default_params).indexOf(param_key) > -1) {
        default_params = this.default_params[param_key];
        if (Array.isArray(default_params)) {
            params = [];
            default_params.forEach(function (param_block) {
                var obj = {};
                that.objCopy(obj, param_block);
                params.push(obj);
            });
        } else {
            this.objCopy(params, default_params);
        }
    }

    if (!Array.isArray(params) && typeof overrides === "object") {
        this.objCopy(params, overrides);
    } else if (Array.isArray(params) && Array.isArray(overrides)) {
        overrides.forEach(function (param_block, index) {
            that.objCopy(params[index], param_block[index]);
        });
    } else if (!Array.isArray(params) && Array.isArray(overrides)) {
        overrides.forEach(function (param_block, index) {
            that.objCopy(params, param_block[index]);
        });
    } else if (typeof overrides === "object") {
        params.forEach(function (param_block, index) {
            that.objCopy(param_block, overrides);
        });
    }
    return params;
});

module.exports.define("objCopy", function (target, source) {
    Object.keys(source).forEach(function (key) {
        target[key] = source[key];
    });
});

module.exports.define("doAssert", function (assert_obj, key) {
    var row = this.scope.page.primary_row;
    var field;
    var result;
    if (assert_obj.linked_row) {
        row = this.scope.page.primary_row.getField(assert_obj.linked_row).getRow(false);
    }
    field = row.getField(key);

    if (assert_obj.blank) {
        result = field.isBlank();
    } else {
        result = assert_obj.get_text ? field.getText() : field.get();
    }

    return result;
});

module.exports.define("doAsserts", function () {
    var that = this;
    if (this.asserts && !this.scope.failed) {
        Object.keys(this.asserts).forEach(function (assert_key) {
            var obj = that.asserts[assert_key];
            var result;
            var expected = obj.expected || obj.value || obj.blank;
            if (typeof that["assert_" + assert_key] !== "function") {
                if (typeof obj.funct === "function") {
                    result = obj.funct(that.scope);
                } else {
                    result = that.doAssert(obj, assert_key);
                }
            } else {
                result = that["assert_" + assert_key]();
            }
            that.assert((expected ? (expected === result) : result), that.id + "." + assert_key + ": " + obj.label);
        });
    }
    this.happen("postAssert");
});

module.exports.define("loadSubTests", function (show_structure) {
    if (Object.hasOwnProperty.call(this, "sub_test")) {
        Object.keys(this.sub_test).forEach(function (sub_test_key) {
            var sub_test_obj = this.sub_test[sub_test_key];
            var path = (sub_test_obj.path || this.path) + sub_test_obj.id + ".js";

            if (sub_test_obj.full_path) {
                path = sub_test_obj.path;
            }
            if (show_structure) {
                print("???");
                if (!this.tests[sub_test_obj.id] && sub_test_obj.show_structure !== false) {
                    this.tests[sub_test_obj.id] = require(path);
                    this.loadTestFixes(path);
                    this.loadTestOverlays(path);
                    this.tests[sub_test_obj.id].level += 1;
                    this.tests[sub_test_obj.id].parent_scope = this.scope;
                    this.tests[sub_test_obj.id].showStructure();
                }
            } else {
                if (sub_test_obj.funct) {
                    print(sub_test_obj.id + ", " + path);
                    this[sub_test_obj.funct](sub_test_obj.id, path);
                } else {
                    print(sub_test_obj.id + ", " + path);
                    this.runSubTest(sub_test_obj.id, path);
                }
            }
        }.bind(this));
    }
});

module.exports.define("showStructure", function () {
    var level = this.level;
    this.scope = this.parent_scope || x.Base.clone({ id: "scope", });
    print(("    ").repeat(level) + "Test " + this.id + ": " + (this.title || ""));
    if (this.asserts) {
        Object.keys(this.asserts).forEach(function (assert_key) {
            print(("     ").repeat(level + 1) + "Assert " + assert_key + ": " + this.asserts[assert_key].label);
        }.bind(this));
    }
    this.loadSubTests(true);
});

module.exports.runFromParent = function (parent_scope, parent_step_id) {
    this.parent_scope = parent_scope;
    this.parent_step_id = parent_step_id;
    this.start();        // sets this.steps = [], initialize counters, etc
    if (this.hasOwnProperty("clearData")) {         // only call clearData() if defined in this object, don't inherit
        this.clearData();
    }
    if (this.hasOwnProperty("testParams")) {        // only call testParams() if defined in this object, don't inherit
        this.testParams();
    }
    if (this.hasOwnProperty("loadOverride")) {      // only call loadOverride() if defined in this object, don't inherit
        this.loadOverride();
    }
    try {
        this.happen("preTest");
        this.loadSubTests();
        this.test();
        this.doAsserts();
    } catch (e) {
        this.report(e);
    }
    this.finish();
};


module.exports.start = function () {
    this.start_date = new Date();
    this.scope = this.parent_scope || Core.Base.clone({ id: "scope", sessions_by_user_id: {} });
    this.scope.test_number = this.parent_scope ? this.parent_scope.test_number : 0;
    this.failed_asserts = 0;
    this.passed_asserts = 0;
    this.failed_cumultv = 0;
    this.passed_cumultv = 0;
    Core.Base.resetLogCounters();
};

module.exports.clearData = function () {
    /**
     * Override if need to remove data from database
     * **/
};


module.exports.assert = function (bool, label) {
    var curr_step_ref = this.getCurrStepRef();

    if (this.scope.failed && !this.ignore_errors) {
        return;
    }
    if (bool) {
        label = "ok " + curr_step_ref + " " +label;
        this.passed_asserts += 1;
    } else {
        label = "not ok " + curr_step_ref + " " +label;
        this.failed_asserts += 1;
        if (!this.ignore_errors && !this.scope.failed) {
            this.scope.failed = true;
            this.scope.error_message = this.scope.session && this.scope.session.messages.getString();
        }
    }
    if (!this.hide_asserts) {
        print(label);
    }
    return bool;
};


module.exports.getCurrStepRef = function () {
    this.scope.test_number += 1;
    return  this.scope.test_number;
};


module.exports.define("sub_test", [
    // {
    //     id: "UnitTests",
    //     path: "core/test/",
    //     funct: "coreTest",
    //     show_structure: false,
    // },
    {
        id: "TestCoverage",
        path: "lazuli-test/TestCoverage.js",
        funct: "coreTest",
        show_structure: false,
        full_path: "lazuli-test/TestCoverage.js",
    },
    // {
    //     id: "ModuleTests",
    //     full_path: true,
    //     path: "core/test/ModuleTestsNew.js",
    //     funct: "coreTest",
    // },
]);

module.exports.define("test", function () {
    return undefined;
});

module.exports.define("coreTest", function (area_id, test_file_path) {
    var run_test = true;

    if (this.type === "unit" && area_id === "ModuleTests") {
        run_test = false;
    }

    if ((this.type === "page" || this.module || this.restart_at_area) && area_id !== "ModuleTests") {
        run_test = false;
    }

    if (run_test) {
        this.runSubTest(area_id, test_file_path);
    }
});


module.exports.define("testCoverage", function (entity, unit) {
    this.addProperties();
    this.clearStartDates();
    //this.runFromParent();
    this.parent_scope   = null;
    this.parent_step_id = null;
    this.start();
    this.runSubTest("TestCoverage", "core/test/TestCoverage.js", { entity: entity, unit: unit, no_report: false });
    this.reportResult();
    this.closeSessions();
});

module.exports.define("loadTestOverlays", function (path) {
    // var overlay_path;
    // if (path.indexOf("core/") === 0) { // allows overlays/core/test
    //     overlay_path = path.replace(/^core\//, "overlays/core/");
    // }

    // if (path.indexOf("") === 0) { // allows overlays/test
    //     overlay_path = path.replace(/^modules\//, "overlays/");
    // }

    // if (overlay_path) {
    //     if (!x.io.File.exists(overlay_path) && x.io.File.exists(overlay_path.replace("test", "Test"))) { //allows test and Test
    //         overlay_path = overlay_path.replace("test", "Test");
    //     }
    //     if (x.io.File.exists(overlay_path)) {
    //         load(overlay_path);
    //     } else {
    //         overlay_path = "";
    //     }
    // }
    // return overlay_path;
});

module.exports.define("loadTestFixes", function (path) {
    // var fixes_path = "fixes/test/" + path.split("/").pop();
    // if (x.io.File.exists(fixes_path)) {
    //     load(fixes_path);
    // } else {
    //     fixes_path = "";
    // }
    // return fixes_path;
});

module.exports.define("addParams", function (params, subtest) {
    if (params) {
        Object.keys(params).forEach(function (param_key) {
            subtest[param_key] = params[param_key];
        });
    }
});

module.exports.define("runSubTest", function (test_obj_id, relative_path, params) {
    var subtest;
    var fixes_path = "";
    var overlay_path = "";

    if (this.scope.failed) {
        return;
    }
    if (!this.tests[test_obj_id]) {
        this.tests[test_obj_id] = require(relative_path);

        fixes_path = this.loadTestFixes(relative_path);
        overlay_path = this.loadTestOverlays(relative_path);
    }

    subtest = this.tests[test_obj_id];
    this.addParams(params, subtest);

    if (!subtest) {
        throw "Subtest not found: " + test_obj_id;
    }

    print(Core.Format.leftJustify(this.getCurrStepRef()) + "            Starting subtest: " + test_obj_id
        + ", relative_path: " + relative_path
        + ", fixes_path: " + fixes_path
        + ", overlay_path: " + overlay_path
        );
    print(subtest + ", " + test_obj_id + ", " + this.tests[test_obj_id] + ", " + relative_path);
    subtest.runFromParent(this.scope, this.getCurrStepRef() + ".");
    subtest.passed = (subtest.failed_asserts === 0);
    this.passed_cumultv += subtest.passed_asserts + subtest.passed_cumultv;
    this.failed_cumultv += subtest.failed_asserts + subtest.failed_cumultv;
    this.assert(subtest.passed, (subtest.title || subtest.id) + ": " + subtest.summary_msg);
});


module.exports.define("changeSession", function (user_id) {
    if (!this.scope.sessions_by_user_id[user_id] || !this.scope.sessions_by_user_id[user_id].active) {
        this.scope.sessions_by_user_id[user_id] = x.Session.clone({ user_id: user_id });
    }
    this.scope.session = this.scope.sessions_by_user_id[user_id];
    return this.scope.session;
});


module.exports.define("closeSessions", function () {
    // this.scope.sessions_by_user_id.forOwn(function (user_id, session) {
    //     session.close();
    // });
});


module.exports.define("equal", function (a, b, sort) {
    var result = true,
        i;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (sort) {
            a.sort();
            b.sort();
        }

        if (a.length !== b.length) {
              result = false;
        } else {
            for (i = 0; i < a.length; i += 1) {
                if (a[i] !== b[i]) {
                    result = false;
                    break;
                }
            }
        }
    } else {
        result = (a === b);
    }

    return result;
});


module.exports.define("contains", function (a, b) {
    var result = true,
        i;

    if (!Array.isArray(a)) {
        result = false;
    } else if (Array.isArray(b)) {
        for (i = 0; i < b.length; i += 1) {
            if (a.indexOf(b[i]) === -1) {
                result = false;
                break;
            }
        }
    } else {
        result = (a.indexOf(b) !== -1);
    }

    return result;
});


module.exports.define("getArray", function (obj, attr) {
  var i,
      len = obj.length,
      result = [];

  if (this.page && typeof(obj) === "object") {
      for (i = 0; i < len; i += 1) {
          if (obj[i].hasOwnProperty(attr)) {
              result.push(obj[i][attr]);
          }
      }
  }

  return result;
});


module.exports.define("finish", function () {
    var time_taken_ms = this.getTimeTakenMs();
    this.summary_msg =
        this.passed_asserts + " (" + this.passed_cumultv + ") asserts passed, " +
        this.failed_asserts + " (" + this.failed_cumultv + ") asserts failed, in " +
        Date.displayTimeInterval(time_taken_ms / 1000);
});


module.exports.define("reportResult", function () {
    print(Core.Format.repeat(" ", 22) + this.summary_msg);
});


module.exports.define("getTimeTakenMs", function () {
    return (new Date()).getTime() - this.start_date.getTime();
});

module.exports.define("testCatch", function (funct, obj, args, message) {
    try {
        funct.call(obj, args);
        this.assert(false, "Expected to throw: " + message );
    } catch (e) {
        if (e === message) {
            this.assert(true, "Expected to throw: " + message );
        } else {
            this.assert(false, "Expected to throw: " + message + ", actually threw: " + e );
        }
    }
});


module.exports.define("names", [
    "Ballou, Olivia",
    "Vining, David",
    "Haws, Leticia",
    "Cone, Steven",
    "Mcgraw, Antonio",
    "Coomer, Lynne",
    "Major, Martha",
    "Huckaby, Jose",
    "Bent, Curtis",
    "Eudy, Joseph",
    "Shorts, Chris",
    "Radcliffe, Richard",
    "Valentin, Douglas",
    "Chaney, Henry",
    "Huie, Edna",
    "Stump, Alan",
    "Barta, Velma",
    "Wells, Clarence",
    "Julien, Olivia",
    "Frey, Lynda",
    "Myatt, Peggy",
    "Clare, Dorothy",
    "Constant, Rosa",
    "Shuck, Cindy",
    "Beale, Kathryn",
    "Posada, Roxanne",
    "Culbreth, Antonio",
    "Gingrich, Claire",
    "Mcmullen, Justin",
    "Zito, Elizabeth",
    "Wenger, Chad",
    "Sargent, Justin",
    "Brien, Craig",
    "Vanbuskirk, Katherine",
    "Clancy, Katrina",
    "Hay, Earl",
    "Janes, Ryan",
    "Ornelas, Johnny",
    "Costanzo, Nellie",
    "Adames, Arlene",
    "Schrock, Emily",
    "Hanson, Curtis",
    "Leung, Katie",
    "Givens, George",
    "Haven, Cecilia",
    "Robinson, Jeff",
    "Natale, Elizabeth",
    "Schweitzer, Edward",
    "Tsosie, Lynne",
    "Moreland, Justin",
    "Felton, Juan",
    "Veliz, Jason",
    "Arana, Howard",
    "Tinker, Roberta",
    "Dayton, Juan",
    "Mccallum, Melissa",
    "Hairston, Russell",
    "Machado, Stephen",
    "Luu, Harry",
    "Stinson, Dora",
    "Isaac, Maggie",
    "Swafford, Eunice",
    "Roddy, Norman",
    "Kutz, Glenda",
    "Board, Jack",
    "Mcclean, Earl",
    "Dunbar, Donald",
    "Castleberry, Samuel",
    "Tracey, Mae",
    "Chalmers, Viola",
    "Levinson, Larry",
    "Marks, William",
    "Mcclure, Samuel",
    "Enriquez, Elaine",
    "Mello, Kathleen",
    "Kline, Darlene",
    "Birchfield, Felicia",
    "Mcgary, James",
    "Mull, Flora",
    "Behrens, Tonya",
    "Neves, Marvin",
    "Linares, Harry",
    "Wiley, Kristy",
    "Chapman, Juan",
    "Gilstrap, Edna"
]);

module.exports.define("getRandomName", function () {
    return this.names[Math.floor(Math.random() * this.names.length)];
});


module.exports.define("lorem",
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore \
    magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo \
    consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. \
    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\
    \
    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem \
    aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. \
    Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores \
    eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, \
    consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam \
    aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit \
    laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea \
    voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla \
    pariatur?\
    \
    At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti \
    atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique \
    sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum \
    facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil \
    impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. \
    Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates \
    repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut \
    reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.");


module.exports.define("words", module.exports.lorem.toLowerCase().replace(/[^\s\w]/g, "").split(/\s/));


module.exports.define("getRandomStringArray", function (options) {
    var array = [];
    function addRange(from, to) {
        var i;
        for (i = from; i <= to; i += 1) {
            array.push(String.fromCharCode(i));
        }
    }
    if (options && options.space) {
        addRange(32, 32);
        addRange(32, 32);
        addRange(32, 32);
        addRange(32, 32);
        addRange(32, 32);
    }
    if (options && options.digits) {
        addRange(48, 57);
    }
    if (!options || options.uppercase || typeof options.uppercase !== "boolean") {
        addRange(65, 90);
    }
    if (!options || options.lowercase || typeof options.lowercase !== "boolean") {
        addRange(97, 122);
    }
    return array;
});


module.exports.define("getRandomString", function (length, array) {
    var i,
        val = "";

    if (typeof length !== "number") {
        throw "x.Test.getRandomString() length must be a number";
    }
    if (typeof array === "string") {
        for (i = 0; i < length; i += 1) {
            val += array.substr(Math.floor(Math.random() * array.length), 1);
        }
        return val;
    }
    if (typeof array === "object" || !array) {
        array = this.getRandomStringArray(array);
    }
    for (i = 0; i < length; i += 1) {
        val += array[Math.floor(Math.random() * array.length)];
    }
    return val;
});


module.exports.define("getRandomWords", function (length, options) {
    var str = "",
        delim = "";

    while (str.length < length) {
        str += delim + this.words[Math.floor(Math.random() * this.words.length)];
        delim = " ";
    }
    return str.substr(0, length);
});


module.exports.define("getRandomNumber", function (to, from, decimals) {
    if (typeof to !== "number") {
        throw "'to' argument must be a number";
    }
    if (typeof from !== "number") {
        from = 0;
    }
    if (to <= from) {
        throw "'to' argument must be greater than 'from'";
    }
    if (typeof decimals !== "number") {
        decimals = 0;
    }
    return (Math.floor(Math.random() * (to - from) * Math.pow(10, decimals)) / Math.pow(10, decimals) + from);
});

/*
// Deprecated
x.Test.testPage = function (session, page_id, page_key, options, params) {
    var page = x.pages[page_id];
    if (!page) {
        throw "Invalid page_id: " + page_id;
    }
    return page.test(session, page_key, options, params);
};

// Deprecated
x.Test.addGridRow = function (page, grid_id, add_row_value, params, field_editable) {
    return page.addGridRow(grid_id, add_row_value, params, field_editable);
};
*/
