/* global module, require */

"use strict";

var Rhino = require("lazuli-rhino/index.js");
var Test = require("lazuli-test/Test.js");
var UI = require("lazuli-ui/index.js");

module.exports = Test.clone({
    id: "ModuleTests",
    fail_diagnostics: true,
    def_vals: {},
});

module.exports.override("start", function () {
    Test.start.call(this);
    this.changeSession("batch");
});

module.exports.override("sub_test", [
    {
        id: "ad",
        path: Rhino.app.version + "/ad/test/ad_test.js",
        full_path: true,
        funct: "areaTest",
    },
    {
        id: "rm",
        path: Rhino.app.version + "/rm/test/rm_test2.js",
        full_path: true,
        funct: "areaTest",
    },
    {
        id: "vr",
        path: Rhino.app.version + "/vr/test/vr_test.js",
        full_path: true,
        funct: "areaTest",
    },
    {
        id: "vc",
        path: Rhino.app.version + "/vc/test2/vc_test.js",
        full_path: true,
        funct: "areaTest",
    },
    {
        id: "ts",
        path: Rhino.app.version + "/ts/test/ts_test.js",
        full_path: true,
        funct: "areaTest",
    },
    {
        id: "sv",
        path: Rhino.app.version + "/sv/test/sv_test.js",
        full_path: true,
        funct: "areaTest",
    },
]);

module.exports.override("test", function () {
//    var that = this;
    // this.areaTest("ad", "ad/test/ad_test.js");
    // this.areaTest("rm", "rm/test/rm_test2.js");
    // this.areaTest("vr", "vr/test/vr_test.js");
    // this.areaTest("vc", "vc/test/vc_test.js");
    // this.areaTest("ts", "ts/test/ts_test.js");
    // this.areaTest("sv", "sv/test/sv_test.js");
});

module.exports.define("areaTest", function (area_id, test_file_path) {
    var backup_path = Rhino.app.local_disk + "/backups/" + Rhino.app.service + "/";
    if (this.restart_at_area === area_id) {
        this.restart_at_area = null;
    }
    if (this.restore_from_area === area_id || this.module === area_id) {
        Rhino.app.restore(backup_path + area_id);
    }
    if (this.dump_before_each_area && !this.restart_at_area && !this.module) {
        Rhino.app.backup(area_id);
    }
    if (!this.restart_at_area && (!this.module || this.module === area_id)) {
        this.runSubTest(area_id, test_file_path);
    }
});

module.exports.define("detokenizeParams", function (params) {
    var that = this;
    if (typeof params !== "object") {
        return;
    }
    Object.keys(params).forEach(function (param_id) {
        var value = params[param_id];
        if (typeof value === "string") {
            params[param_id] = that.scope.detokenize(value);
        }
    });
});

module.exports.define("wasPageSuccessful", function (page, options) {
    options = options || {};
    return (!!page && ((!page.trans && !page.transactional) ||
        (page.active === true  && options.not_saving) ||
        (page.active === false &&  page.trans.saved && !options.fail_expected) ||
        (page.active === false && !page.trans.saved && (options.fail_expected || options.allow_no_modifications))));
});


module.exports.define("testPage", function (page_id, params, options) {
    params = params || {};
    options = options || {};
    // this.scope.session.messages.clear();
    this.scope.page = null;
    this.scope.result = {
        params: params,
        options: options,
    };

    if (this.show_structure || (this.scope.failed && !this.ignore_errors)) {
        return;
    }

    if (options.session_user_id) {
        this.changeSession(options.session_user_id);
    }
    if (!options.no_detokenize && options.no_def_vals !== true && this.def_vals && this.def_vals.hasOwnProperty(page_id)) {
        this.detokenizeParams(params);
        this.def_vals[page_id](params, options);
    }
    if (!options.no_detokenize) {
        this.detokenizeParams(params);
    }
    if (typeof options.not_saving !== "boolean" && (!params.page_button || params.not_saving)) {
        options.not_saving = true;
    }
    try {
        this.scope.page = this.scope.session.getPage(page_id, params.page_key);
        this.scope.result.expectation = this.determineExpectation(this.scope.page, params, options);
        // if (typeof options.allow_no_modifications === "boolean") {
        //     this.scope.page.getTrans().allow_no_modifications = options.allow_no_modifications;
        // }
        this.scope.page.update(params);
        this.scope.result.messages = this.scope.session.messages.getString();
        this.scope.result.state = this.getResultState(this.scope.page);
        this.scope.result.outcome_id = this.scope.page.outcome_id;

        this.scope.page_id = this.scope.page.id;
        if (this.scope.page.primary_row) {
            this.scope.this_page_key = this.scope.page.page_key;
            this.scope.page_key = this.scope.page.primary_row.getKey(); // deprecated

            // whenever the page creates it's primary row, this will be different
            this.scope.next_page_key = this.scope.page.primary_row.getKey();

            this.debug("setting scope.page_key to: " + this.scope.page_key);
        }
        if (!this.scope.page.active) {
            this.scope.session.messages.clear();
        }
    } catch (e) {
        this.scope.result.state = e.id;
        this.scope.result.exception = e.toString();
    }

    this.scope.result.passed = (this.scope.result.expectation === this.scope.result.state);

    if (!this.scope.result.passed && this.fail_diagnostics) {
        if (this.scope.page) {
            this.scope.result.wf_json = this.getWfNode(this.scope.page);
        }
        print(JSON.stringify(this.scope.result));
    }

    if (!options.no_assert || (this.break_on_fail && !this.scope.result.passed)) {
        // throws exception if break_on_fail
        this.assert(this.scope.result.passed, (options.test_condition || page_id) +
            " - expected: " + this.scope.result.expectation + ", actual: " + this.scope.result.state);
    }

    return this.scope.page;
});

module.exports.define("determineExpectation", function (page, params, options) {
    options = options || {};
    return options.expectation || (
        options.not_saving ? "active" : (          // backward compatibility
            options.fail_expected ? "fail" : (
                options.allow_no_modifications ? "no_modifications" : (
                    options.access_denied_expected ? "access_denied" : (
                        options.error_code ? options.error_code : (
                            params.page_button && (page.trans || page.transactional) ? "saved" : "active"
                        )
                    )
                )
            )
        )
    );
});


module.exports.define("getResultState", function (page) {
    return (
        (page.active === true) ? "active" : (
            (!page.trans || !page.trans.saved) ? "fail" : "saved"));
});


/*
 * change the sort order of a list and render the page
 * params only for setting sort order, a JSON object { order: "asc/desc", field: "field to user for sort" }
 */
module.exports.define("updateList", function (section, params, page) {
    var order,
        field;

    params = params || {};
    if (page && UI.pages.hasOwnProperty(page)) {
        this.getPage(page);
    }
    if (params.hasOwnproperty("sort")) {
        order = params.sort;
        field = params.field || "id";

        params.page_button = "list_sort_" + ((order === "asc")  ? "asc" : "desc") + "_" + section + "_" + field;
        delete params.sort;
    }

    this.scope.page.update(params);
    this.render();
});

/*
 * update search values and render the page
 * possible to set sort order to params
 */
module.exports.define("updateSearch", function (section, url_components, params, page) {
    params = params || {};
    if (page && UI.pages.hasOwnProperty(page)) {
        this.getPage(page);
    }
    this.scope.page.sections.get(section).setURLComponents(url_components);
    this.updateList(section, params);
});

/*
 * results is an array of JSON objects { field: "field to check", value: "value to compare to" }
 * function compares the results in given order from the beginning of list resultset
 * only when this.scope.page and this.scope.page.rendered
 */
module.exports.define("compareListResults", function (section, results) {
    var len = results.length, i, entity,
        list,
        result = false,
        list_results = [],
        test_results = [];

    if (this.scope.page && this.scope.page_rendered) {
        list = this.scope.page.sections.get(section);
        for (i = 0; i < len; i += 1) {
            entity = list.test_values[i];
            list_results.push(entity[results[i].field]);
            test_results.push(results[i].value);
        }
        this.debug(list_results);
        this.debug(test_results);
        result = this.equal(list_results, test_results);
    }
    return result;
});

/*
 * returns the count of total rows for the list
 */
module.exports.define("listRowCount", function (section) {
    var query = this.scope.page.sections.get(section).query,
        row_count = 0;

    if (this.scope.page_rendered) {
        row_count = query.found_rows;
    } else {
        if (query.resultset && query.next()) {
            query.resultset.last();
            row_count = query.resultset.getRow();
            query.resultset.first();
        }
    }

    return row_count;
});

/**
 * section_name = id of the chart section
 * fields = array of objects to test, object structure
 *  { name  : <series name>     , field   : <point to test>,
 *    value : <value to compare>, operator : <comparison operator> }
 */
module.exports.define("getChartValues", function (section_name, fields) {
    var series,
        serie,
        data,
        section,
        result = (Array.isArray(fields) && fields.length > 0);

    if (this.scope.page && this.scope.page_rendered && result) {
        section = this.scope.page.sections.get(section_name);
        data = section.test_data;
        for (series = 0; series < fields.length; series += 1) {
            serie = fields[series];
            if (data.hasOwnProperty(serie.name)) {
                result = result && (serie.value === data[serie.name][serie.field]);
                //print(serie.value + " === " + data[serie.name][serie.field] + " -> " + (serie.value === data[serie.name][serie.field]));
            } else {
                result = false;
                break;
            }
        }
    }
    return result;
});

module.exports.define("changeTab", function (tab_id) {
    if (this.scope.page) {
        this.scope.page.update({ page_tab : tab_id });
    }
});

module.exports.define("render", function (page, key) {
    var page_key = key || this.scope.page_key || null,
        byte_array = new java.io.ByteArrayOutputStream(),
        out = new java.io.PrintStream(byte_array),
        stream;

    this.scope.page_html = "";
    this.scope.page_rendered = false;
    if (page && x.pages.hasOwnProperty(page)) {
        this.scope.page = this.scope.session.getPage(page, page_key);
    }

    if (this.scope.page) {
        try {
            stream = x.XmlStream.clone({ id: "test_xmlstream", name: "div", out: out, indent: null });
            this.scope.page.render(stream, { test: true });
            this.scope.page_rendered = true;
        } catch (e) {
            print("RENDER ERROR " + page);
        } finally {
            stream.close();
            this.scope.page_html = byte_array.toString("UTF-8");
        }
    }
});


module.exports.define("getMandatory", function () {
    return (Array.isArray(this.scope.messages.obj.mandatory)) ? this.scope.messages.obj.mandatory : [];
});

module.exports.define("getLinks", function (attr) {
    attr = attr || "id";
    return this.getArray(this.scope.pageJSON.links, attr);
});

module.exports.define("getTabs", function (attr) {
    attr = attr || "id";
    return this.getArray(this.scope.pageJSON.tabs, attr);
});

module.exports.define("printPageResults", function (pages) {
    var page_id,
        i, len;

    if (!Array.isArray(pages)) {
        return;
    }

    len = pages.length;
    for (i = 0; i < len; i += 1) {
        /*page_id = pages[i];
        this.pageResult(page_id, this.report_msgs);*/
        print(i + "\t" + pages[i].label + this.spacesToReport(pages[i].label) + pages[i].parent);
    }
});

module.exports.define("pageResult", function (page_id, msgs) {
    var page = this.pages[page_id],
        msg_id,
        msgs_len,
        show_msg = (typeof(msgs) === "boolean") ? msgs : true,
        i;

    /*print(page.page + " -> " + page.key + " (" + page_id + ")");
    if (show_msg && page.msg.hasOwnProperty("msgs") && Array.isArray(page.msg.msgs)) {
        msgs = page.msg.msgs;
        msgs_len = msgs.length;
        for (msg_id = 0; msg_id < msgs_len; msg_id += 1) {
            print("\t" + msgs[msg_id]);
        }
    }*/
    for (i = 0; i < msgs.length; i += 1) {
        print(msgs[i].label + "\t" + msgs[i].parent + "\t" + i);
    }
});

module.exports.define("printPathChildren", function (json, level) {
    var i;
    if (json.hasOwnProperty("children")) {
        for (i = 0; i < json.children.length; i += 1) {
            if (json.hasOwnProperty(json.children[i])) {
                print("\n");
                print("\t".repeat((level+1)) + json.children[i]);
                this.printWfPath(json[json.children[i]], level+1);
            }
        }
    }
});

module.exports.define("addWfPath", function (json, id) {
    // Override to each test if needed

    /*
     * Use this to create more accurate order of wf_nodes and their relations to pages
     */
});

module.exports.define("getWfNode", function (page) {
    var wf_node,
        ret;

    if (Array.isArray(page.performing_wf_nodes)) {
        wf_node = page.performing_wf_nodes[0];
        if (wf_node.tmpl_node_id) {
            ret = { id: wf_node.tmpl_node_id, outcome_id: page.outcome_id };
        }
    }
    return ret;
});

module.exports.define("printWfPath", function (json, level) {
    var inst;
    level = level || 0;

    for (inst in json) {
        if (json.hasOwnProperty(inst)) {
            if (json[inst].hasOwnProperty("wf")) {
                print("\t".repeat(level) + inst + " -> ");
                this.printWfPath(json[inst].wf, level+1);
            } else if (json[inst].hasOwnProperty("id")) {
                print("\t".repeat(level) + json[inst].id + " -> " + json[inst].outcome_id);
            }
            this.printPathChildren(json[inst], level);
        }
    }
});

module.exports.define("wfPathReport", function () {
    var module;
    for (module in this.wf_path) {
        if (this.wf_path.hasOwnProperty(module)) {
            print(module);
            if (this.wf_path.hasOwnProperty(module)) {
                this.printWfPath(this.wf_path[module]);
            }
        }
    }
});

module.exports.define("wfReport", function () {
    var wf_node;
    for (wf_node in this.wf_nodes) {
        if (this.wf_nodes.hasOwnProperty(wf_node)) {
            print(this.wf_nodes[wf_node].id + " -> " + this.wf_nodes[wf_node].outcome_id);
        }
    }
});

module.exports.define("checkOutcomes", function (page, page_id, not_existing, path) {
    var outcome;
    if (page.transactional) {
        if (!page.outcomes) {
            page.outcomes = {save : 1};
        }
        for (outcome in page.outcomes) {
            if (page.outcomes.hasOwnProperty(outcome)) {
                if (!not_existing.hasOwnProperty(page_id)) {
                    not_existing[page_id] = [];
                }
                not_existing[page_id].push(outcome);
            }
        }
    }
});

module.exports.define("reportNonTestedPages", function () {
    var not_existing = {},
        ignore = ["home", "privacy", "inspect", "apidocs", "context", "_wf_", "_base", "_tx" ],
        page_id, i, reg,
        path, page, entity, skip;

    function skipAutomatic(node) {
        if (node.hasOwnProperty("page_id") && node.page_id === page.id) {
            if (node.automatic) {
                skip = true;
            }
        }
    }
    for (page_id in UI.pages) {
        if (UI.pages.hasOwnProperty(page_id)) {
            page = x.pages[page_id];
            entity = page.entity;
            skip = false;

            for (i = 0; i < ignore.length; i += 1) {
                reg = new RegExp(ignore[i], "g");
                if (page.id.match(reg)) {
                    skip = true;
                    break;
                }
            }

            if (entity && x.Workflow.templates.hasOwnProperty(entity.id) && !skip) {
                x.Workflow.templates[entity.id].nodes.each(skipAutomatic);
            }

            if (!skip) {
                if (Test.path.hasOwnProperty(page_id)) {
                    path = Test.path[page_id];
                    this.checkOutcomes(page, page_id, not_existing, path);

                } else {
                    not_existing[page_id] = [];
                    this.checkOutcomes(page, page_id, not_existing, {});
                }
            }
        }
    }

    for (i in not_existing) {
        if (not_existing.hasOwnProperty(i)) {
            print( i + " -> " + not_existing[i]);
        }
    }
});
