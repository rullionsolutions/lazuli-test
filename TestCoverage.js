"use strict";

var Test = require("lazuli-test/Test.js");
var Data = require("lazuli-data/index.js");
var IO = require("lazuli-io/index.js");
var Rhino = require("lazuli-rhino/index.js");
var x;

module.exports = Test.clone({
    id: "TestCoverage",
    override_functs: [],
});

module.exports.define("overrideFunction", function (base, func, override, arr) {
    var old_func;

    arr = arr || this.override_functs;

    if (typeof base[func] === "function") {
        old_func = base[func];
        base[func] = override;
        arr.push({ base: base, func: func, old_func: old_func });
    }
});

module.exports.define("resetFunctions", function (arr) {
    arr = arr || this.override_functs;
    arr.forEach(function (obj) {
        obj.base[obj.func] = obj.old_func;
    });
    this.override_functs = [];
});

module.exports.override("test", function () {
    var that = this,
        base_overrides = [];
    x = Test.x;
    this.passed  = 0;
    this.tests   = 0;
    this.results = {};

//    this.overrideFunction(x.Entity, "reload", function (key) {
//            if (rows[this.table][key]) {
//                this.modifiable = true;
//                this.populate(rows[this.table][key]);
//            }
//    }, base_overrides);

//    this.overrideFunction(x.Entity, "populate", function (resultset) {
//        var key_fields = this.primary_key.split(","),
//            delim = "",
//            i,
//            key_field;

//        this.each(function (field) {
//            if (field.ignore_in_query) {
//                return;
//            }
//            field.set(resultset.getField(field.id).get());
//            //field.setFromResultSet(resultset);
//        });
//        this.key = "";
//        for (i = 0; i < key_fields.length; i += 1) {
//            key_field = this.getField(key_fields[i]);
//            if (!key_field) {
//                throw x.Exception.clone({ id: "field_not_found", field: key_fields[i], entity: this.id });
//            }
//            key_field.fixed_key = true;
//            this.key += delim + key_field.get();
//            delim = ".";
//        }
//    }, base_overrides);

    this.ignore_errors = true;
    Data.entities.forOwn(function (key, entity) {
        var path = Rhino.app.sapphire_dir + "/" + entity.area + "/test/units/";
        if (!that.entity ||
                (that.entity && (that.entity === key
                        || (Array.isArray(that.entity) && that.entity.indexOf(key) > -1)
                 ))) {
            that.results[entity.id] = {};
            that.coverage(key, path, that.results[entity.id]);
        }
    });
    this.ignore_errors = false;
    //this.resetFunctions(base_overrides);
    if (IO.File.exists("reports") && !this.no_report) {
        this.renderReport();
    }
});

module.exports.define("renderResult", function (parent, result) {
    var table, tr;

    table = parent.addChild("table");

    result.forOwn(function (test, test_result) {
        tr = table.addChild("tr");
        tr.addChild("td").attribute("style", "width: 20px; background-color: " + (test_result ? "green" : "red"));
        tr.addChild("td").addText(test);
    });
});

module.exports.define("renderEntityCoverage", function (parent) {
    var that = this;
    this.results.forOwn(function (entity, result) {
        if (Object.keys(result).length > 0) {
            parent.addChild("h3").addText(entity);
            that.renderResult(parent, result);
        }
    });
});

module.exports.define("renderReport", function () {
    out = new java.io.PrintStream(new java.io.BufferedOutputStream(new java.io.FileOutputStream(new java.io.File("reports/index.html"))), true);
    xmlstream = x.XmlStream.clone({ id: "http_xmlstream", name: "html", out: out, indent: null });

    xmlstream.addChild("h2").addText("Test Coverage " + x.app.app_id + " / " + x.app.version);
    xmlstream.addChild("span").addText("Functions found: " + this.tests + ", tests found: "+ + this.passed + " -> coverage: " + x.lib.round((this.passed/this.tests)*100, 2) + "%" );

    this.renderEntityCoverage(xmlstream);

    xmlstream.close();
    out.close();
});

module.exports.define("coverage", function (entity_id, test_path, results) {
    var entity = Data.entities[entity_id],
        file_path,
        test_exists,
        overlay_path,
        f;
    for (f in entity) {
        if (entity.hasOwnProperty(f) && typeof entity[f] === "function" && (!this.unit || (this.unit === f || (Array.isArray(this.unit) && this.unit.indexOf(f) > -1)))) {
            file_path = test_path + entity_id + "_" + f + ".js";
            overlay_path = "overlays/" + file_path;
            this.tests += 1;
            test_exists = false;

            if (IO.File.exists(file_path)) {
                load(file_path);
                test_exists = true;
            }
            if (IO.File.exists(overlay_path)) {
                load(overlay_path);
                test_exists = true;
            } else {
                overlay_path = overlay_path.replace("test", "Test");
                if (IO.File.exists(overlay_path)) {
                    load(overlay_path);
                    test_exists = true;
                }
            }
            if (test_exists) {
                if (x.test.TestCoverage[entity_id + "_" + f] && typeof x.test.TestCoverage[entity_id + "_" + f] === "function") {
                    results[f] = true;
                    this.passed += 1;
                    try {
                        this[entity_id + "_" + f]();
                    } catch (e) {
                        this.report(e);
                        this.passed -= 1;
                        results[f] = false;
                    }
                    this.resetFunctions();
                } else {
                    results[f] = false;
                }
            } else {
                results[f] = false;
            }
        }
    }

    if (this.unit && typeof this.unit === "string" && !entity.hasOwnProperty(this.unit)) {
        this.error("Function " + this.unit + " isn't defined in " + entity.id);
    }
});

module.exports.define("testQuery", (function () {
    var current_result = -1,
        results = [],
        current_row,
        conditions = [],
        resultset,
        connection_open = false;

    resultset = {
        getBytes: function () {
            return;
        }
    };
    function addResult(row) {
        //TODO May want to add a _key field.
        //May alternatively want to rethink the idea of using entities as result items. They
        //  lack many features. (e.g. sorting)
        results.push(row);
    }
    function addCondition(condition) {
        //This function is quite messy at the moment. I've convinced myself that improving it would be wasted time at
        //this stage, as it is still under construction as more condition types are added.
        //Quoth Tony Hoare: "Premature optimisation is the root of all evil"
        if (!!condition.column) {
            //Mock query does not currently support other forms of condition
            if (condition.column.split(".").length !== 2) {
                throw x.Exception.clone({ id: "no_table_alias", text: "Convention dictates query conditions should always use a table alias" });
            }
            conditions.push(condition);
        } else if (!!condition.full_condition && condition.full_condition.indexOf(" IN ") > -1) {
            conditions.push(condition);
        }
    }
    function getColumn(key) {
        var stripped_key = key.split(".")[1];
        if (!!current_row) {
            return current_row.getField(stripped_key);
        }
        //I'm not entirely sure about this next bit. But I have definitely seen getColumn called before a .next()
        if (current_result === -1 && results[current_result + 1]) {
            return results[current_result + 1].getField(stripped_key);
        }
        throw x.Exception.clone({ id: "no_result_column", text: "Called getColumn on a testQuery without any results"});
    }
    function checkInCondition(condition) {
        var split_condition,
            field,
            list,
            i;

        split_condition = condition.full_condition.split(" IN ");

        field = split_condition[0];
        list = split_condition[1].replace(/[' \(\)]/g, "").split(",");

        for (i = 0; i < list.length; i += 1) {
            if (getColumn(field).get() === list[i]) {
                return true;
            }
        }
        return false;
    }
    function checkConditions() {
        var i,
            condition,
            column_value;

        for (i = 0; i < conditions.length; i += 1) {
            condition = conditions[i];
            if (condition.full_condition) {
                if (condition.full_condition.indexOf(" IN ") > -1) {
                    if (checkInCondition(condition) === false) {
                        return false;
                    }
                }
            } else {
                column_value = getColumn(condition.column).get();
                if(column_value === undefined) {
                    throw "Attempting to match column " + condition.column + ", but it could not be found on query result";
                }
                if (condition.operator === "=") {
                    if (column_value !== condition.value) {
                        return false;
                    }
                } else if (condition.operator === "<>") {
                    if (column_value === condition.value) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    function next() {
        connection_open = true;
        do{
            current_result += 1;
            current_row = results[current_result];
            if (!current_row) {
                return false;
            }
            if (checkConditions() === true) {
                return true;
            }
        } while (current_result < (results.length - 1));
        current_row = null;
        return false;
    }
    function getRow() {
        return current_row;
    }
    function reset() {
        current_result = -1;
        results = [];
        conditions = [];
        current_row = null;
        connection_open = false;
        return;
    }
    function isConnectionOpen() {
        return connection_open;
    }
    return {
        isConnectionOpen: isConnectionOpen,   //To allow testing for cleaning up after yourself
        resultset: resultset,
        addCondition: addCondition,
        next: next,
        getColumn: getColumn,
        getRow: getRow,
        addResult: addResult,
        reset: reset,
        conditions: conditions  //TODO review if this should be made public. There are tests which retrieve it,
                                //but maybe only tests. If so, use a getter function, and make the array private.
    };
}()));
