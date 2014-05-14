/*global define, Handlebars*/
define(['jquery', 'dataTables', 'timeElements', 'text!hbCells', 'extend-moment', 'handlebars', 'helpers', 'moment'], function ($, dt, timeElements, hbCellsText, extendMoment, hb, helpers, moment) {

    "use strict";

    var hbCells = Handlebars.compile(hbCellsText);

    var privFunc = {
        getPropertyOnData: function (data, property) {
            if (property === undefined) {
                return undefined;
            }

            if (typeof property === 'string' || property instanceof String) {
                return data[property];
            }

            return property(data);
        }
    };

    var cellFunc = {
        revision: function (index, property) {
            return {
                "aTargets": [index],
                "sClass": "txt-align-left",
                "mRender": function (data, type, full) {
                    var sourceStamps = privFunc.getPropertyOnData(full, property);

                    return hbCells({revisionCell: true, 'sourceStamps': sourceStamps});
                }
            };
        },
        buildID: function (index) {
            return {
                "aTargets": [index],
                "sClass": "txt-align-left",
                "mRender": function (data, type, full) {
                    return hbCells({buildID: true, 'data': full});
                }
            };
        },
        buildStatus: function (index, className) {
            return {
                "aTargets": [index],
                "sClass": className === undefined ? "txt-align-left" : className,
                "mRender": function (data, type, full) {
                    return hbCells({buildStatus: true, 'build': full});
                },
                "fnCreatedCell": function (nTd, sData, oData) {
                    $(nTd).removeClass().addClass(oData.results_text);
                }
            };
        },
        shortTime: function (index, property) {
            return {
                "aTargets": [index],
                "sClass": "txt-align-left",
                "mRender": function (data, type, full) {
                    var time = privFunc.getPropertyOnData(full, property);
                    return extendMoment.getDateFormatted(time);
                }
            };
        },
        slaveName: function (index, slaveNameProperty, slaveURLProperty, className) {
            return {
                "aTargets": [index],
                "sClass": className === undefined ? "txt-align-left" : className,
                "mRender": function (data, type, full) {
                    var name = privFunc.getPropertyOnData(full, slaveNameProperty);
                    var url = privFunc.getPropertyOnData(full, slaveURLProperty);
                    return hbCells({slaveName: true, 'name': name, 'url': url});
                }
            };
        },
        slaveStatus: function (index) {
            return {
                "aTargets": [index],
                "mRender": function (data, full, type) {
                    var statusTxt,
                        isRunning = false;
                    if (type.connected === undefined || type.connected === false) {
                        statusTxt = 'Offline';
                    } else if (type.connected === true && type.runningBuilds === undefined) {
                        statusTxt = 'Idle';
                    } else if (type.connected === true && type.runningBuilds.length > 0) {
                        statusTxt = type.runningBuilds.length + ' build(s) ';
                        isRunning = true;
                    }
                    return hbCells({slaveStatus: true, showStatusTxt: statusTxt, showSpinIcon: isRunning});
                },
                "fnCreatedCell": function (nTd, sData, oData) {
                    if (oData.connected === undefined) {
                        $(nTd).addClass('offline');
                    } else if (oData.connected === true && oData.runningBuilds === undefined) {
                        $(nTd).addClass('idle');
                    } else if (oData.connected === true && oData.runningBuilds.length > 0) {
                        var overtime = 0;
                        if (oData.runningBuilds !== undefined) {

                            $.each(oData.runningBuilds, function (key, value) {
                                if (value.eta !== undefined && value.eta < 0) {
                                    overtime += 1;
                                }
                            });
                            overtime = overtime > 0 ? overtime : false;
                        }

                        $(nTd).addClass('building').find('a.popup-btn-json-js').data({showRunningBuilds: oData});

                        if (overtime) {
                            $(nTd).removeClass('building')
                                .addClass('overtime tooltip')
                                .attr('title', "One or more builds on overtime");

                            helpers.tooltip($(nTd));
                        }
                    }
                }
            };
        },
        buildProgress: function (index, singleBuild) {
            return {
                "aTargets": [index],
                "sClass": "txt-align-left",
                "mRender": function (data, full, type) {
                    return hbCells({
                        buildProgress: true,
                        showPending: !singleBuild,
                        pendingBuilds: singleBuild ? undefined : type.pendingBuilds,
                        currentBuilds: singleBuild ? [type] : type.currentBuilds,
                        builderName: type.name
                    });
                },
                "fnCreatedCell": function (nTd, sData, oData) {
                    var bars = $(nTd).find('.percent-outer-js');
                    $.each(bars, function (key, elem) {
                        var obj = $(elem);
                        timeElements.addProgressBarElem(obj, obj.attr('data-starttime'), obj.attr('data-etatime'));
                    });
                }
            };
        },
        buildLength: function (index) {
            return {
                "aTargets": [index],
                "sClass": "txt-align-left",
                "mRender": function (data, full, type) {
                    var times = type.times;
                    if (times !== undefined && times.length === 2) {
                        var d = moment.duration((times[1] - times[0]) * 1000);
                        return "{0}m {1}s ".format(d.minutes(), d.seconds());
                    }
                    return "N/A";
                }
            };
        }
    };

    var tableFunc = {
        buildTableInit: function ($tableElem) {
            var options = {};

            options.aoColumns = [
                { "mData": null, "sTitle": "#", "sWidth": "5%" },
                { "mData": null, "sTitle": "Date", "sWidth": "10%" },
                { "mData": null, "sTitle": "Revision", "sWidth": "30%" },
                { "mData": null, "sTitle": "Result", "sWidth": "32%", "sClass": ""},
                { "mData": null, "sTitle": "Build Time", "sWidth": "10%" },
                { "mData": null, "sTitle": "Slave", "sWidth": "13%" }
            ];

            options.aoColumnDefs = [
                cellFunc.buildID(0),
                cellFunc.shortTime(1, function (data) {
                    return data.times[0];
                }),
                cellFunc.revision(2, "sourceStamps"),
                cellFunc.buildStatus(3),
                cellFunc.buildLength(4),
                cellFunc.slaveName(5, function (data) {
                    if (data.slave_friendly_name !== undefined) {
                        return data.slave_friendly_name;
                    }
                    return data.slave;
                }, "slave_url", "txt-align-right")
            ];

            return dt.initTable($tableElem, options);
        },
        rtfGenericTableProcess: function ($table, data) {
            timeElements.clearTimeObjects($table);
            $table.fnClearTable();

            try {
                $table.fnAddData(data);
                timeElements.updateTimeObjects();
            } catch (err) {
            }
        }

    };

    return {
        table: tableFunc,
        cell: cellFunc
    };
});