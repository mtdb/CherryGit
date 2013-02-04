var FB_TOKEN = null;
var ERR = "Error :s<br>Try again...";
var __mutex__ = false;
var MUTEX = function () {return __mutex__};
$.extend(MUTEX, {
    on: function () {__mutex__ = true; GITJ.wait()},
    off:function () {__mutex__ = false; GITJ.wait.end()}
});
var GITJ = {
    init: function () {
        var _this = this;
        _this.drawGraph();
        
        $(document).on("click", "[data-action]", function () {
            var action = $(this).data().action;
            _this[action]($(this));
        });

        $(document).on('click', 'li.commit, #state li', function () {
            $("li.commit.active").removeClass("active");
            $("li.commit, #state li.active").removeClass("active");
            $(this).addClass("active");
        });

        $(document).on('change','#local-branch', function (option) {
            var branch = option.srcElement.selectedOptions[0].value;
            if (branch == "__newbranch__") {
                _this.newBranchModal();
            }
            else {
                _this.checkout(branch)
            }
        });

        $(document).on('change','#repositories', function (option) {
            var repo = option.srcElement.selectedOptions[0].value;
            if (repo == "__openrepo__") {
                _this.openRepoModal();
            }
            else {
                _this.openRepo(repo)
            }
        });

        $(document).on('click', 'li.commit, #state li.commit', function () {
            _this.diff_stat($(this).data().hexsha);
        });

        $(document).on('click', '#state li.file', function () {
            _this.diff({path:$(this).data().path, mode:$(this).data().mode, status:$(this).attr("data-status").toLocaleLowerCase()});
        });

        $(document).on('click', '#details .commit-details a', function () {
            var commit = $(this).parents('.commit-details').data().commit;
            _this.diff({path:$(this).text(), commit:commit});
        });

        $(document).on('click', '#state li.active', function () {
            var status = $(this).attr("data-status");
            var row = $(this);
            var path = $(this).data().path;
            if (status == "Stage")
                _this.stage(path, row);
            else if (status == "Unstage")
                _this.unstage(path, row);
        });

        $('.modalbox .close').click(function (e) {
            e.preventDefault();
            $(".result").text("...output...");
            $("#mask, .modalbox").hide();
        });

        $('#mask').click(function () {
            $(this).hide();
            $(".modalbox").hide();
        });

        $("#pullbox #remote, #pushbox #remote").change(function () {
            var remote = $(this).find("option:selected").val();
            var localBranch = $("#local-branch").val();
            if ($(this).parents("#pullbox").length)
                var target = $("#pullbox #branch");
            else
                var target = $("#pushbox #branch");
            $.getJSON("/git/get_branches_in_remote/",
                {'remote':remote},
                function(branches) {
                    target.find("option").remove()
                    var options = "";
                    for (i in branches) {
                        //TODO: mejorar match con expresión regular
                        if (branches[i].match(localBranch))
                            options = "<option value='"+branches[i]+"'>"+branches[i]+"</option>"+options;
                        else
                            options += "<option value='"+branches[i]+"'>"+branches[i]+"</option>";
                    }
                    target.append(options);
                });
        });
        
        $("#tree").scroll( function() {
            //TODO: exec drawGraph
            if  ($("#tree").scrollTop() == $("#tree ul").height()-$("#tree").height()) {
                if ($(".loading").length == 0) {
                    var skip = $("#tree").attr("data-list-length");
                    $("#tree ul").append("<li class='loading'>Loading...</li>");
                    $.get("/gui/commits/", {skip:skip}, function (commits) {
                        $("#tree").attr("data-list-length",parseInt(skip)+20);
                        $("#tree ul").append(commits);
                        $(".loading").remove();
                    })
                }
            }
        });

        //TODO: unificar contextmenu's
        $(document).on("contextmenu","*:not([data-context-menu])",function(e) {
            var cmenu = $("#nothingtodohere");
            $('<div class="overlay"></div>').css({
                left: '0px',
                top: '0px',
                position: 'absolute',
                width: '100%',
                height: '100%',
                zIndex: '100'
            }).click(function () {
                $(this).remove();
                cmenu.hide();
            }).on('contextmenu' , function(){return false;}).appendTo(document.body);
            cmenu.css({left:e.pageX, top:e.pageY, zIndex:'101' }).show();
            return false;
        });

        $(document).on("contextmenu","[data-context-menu]",function(e) {
            var cmenu = $("#"+$(this).data().contextMenu);
            $.extend(GITJ, {'context_menu_target':$(this)})
            $('<div class="overlay"></div>').css({
                left: '0px',
                top: '0px',
                position: 'absolute',
                width: '100%',
                height: '100%',
                zIndex: '100'
            }).click(function () {
                $(this).remove();
                cmenu.hide();
            }).on('contextmenu' , function(){return false;}).appendTo(document.body);
            cmenu.css({left:e.pageX, top:e.pageY, zIndex:'101' }).show();
            return false;
        });

        $(document).on('click', '.vmenu .first_li', function(e) {
            if( $(this).children().size() == 1 ) {
                switch ($(this).data().value) {
                    case 'revert':
                        $("#revertbox .file").text(_this.context_menu_target.data().path);
                        $("#revertbox .file").attr("data-mode",_this.context_menu_target.data().mode);
                        _this.modal("#revertbox");
                        break;
                    case 'refresh':
                        _this.refresh();
                        break;
                    case 'stage':
                        var path = _this.context_menu_target.data().path;
                        var row = _this.context_menu_target;
                        _this.unstage(path,row)
                        break;
                    case 'unstage':
                        var path = _this.context_menu_target.data().path;
                        var row = _this.context_menu_target;
                        _this.stage(path,row)
                        break;
                    case 'modal-profile':
                        var name = _this.context_menu_target.parents("li.commit")
                            .data().authorName;
                        var email = _this.context_menu_target.parents("li.commit")
                            .data().authorEmail;
                        _this.profileModal(name,email);
                        break;
                    case 'addgitignore':
                        var path = _this.context_menu_target.data().path;
                        _this.gitignoreModal(path);
                        break;
                    default:
                        alert('unimplemented :(\n'+$(this).data().value);
                }
                $('.vmenu').hide();
                $('.overlay').hide();
            }
        });
    },
    openRepo: function (path) {
        if (MUTEX()) return; MUTEX.on();
        var _this = this;
        $.post("/git/open/", {path:path})
        .success(function () {
            _this.refreshAll();
        })
        .error(function (e) {
            console.log(e.responseText.substring(0,300));
        })
        .complete(function (e) {
            MUTEX.off();
        });
    },
    checkout: function (branch) {
        if (MUTEX()) return; MUTEX.on();
        var _this = this;
        $.post("/git/checkout/",{
            branch:branch,
        })
        .success(function () {
            _this.refreshAll();
        })
        .error(function (e) {
            console.log(e.responseText.substring(0,300));
        })
        .complete(function (e) {
            MUTEX.off();
        });
    },
    refresh: function () {
        var _this = this;
        $("#details>div").text("");
        $("#state").load("/gui/status/");
        $("#tree").attr("data-list-length",20);
        $("#tree ul").load("/gui/commits/", function () {
            _this.drawGraph();
        });
        
    },
    refreshAll: function () {
        location.reload();
    },
    modal: function(box) {
        var maskHeight = $(document).height()-52;
        var maskWidth = $(window).width();

        $('#mask').css({'width':maskWidth,'height':maskHeight});
        $('#mask').fadeIn(300);

        var winH = $(window).height();
        var winW = $(window).width();

        $(box).css('top',  winH/2-$(box).height()/2);
        $(box).css('left', winW/2-$(box).width()/2);

        $(box).fadeIn(400);
    },
    modalClose: function() {
        $('#mask').fadeOut(300);
        $(".modalbox").fadeOut(200);
    },
    revert: function() {
        var _this = this;
        $.post("/git/checkout/",{
                path:$("#revertbox").find(".file").text(),
                state:$("#revertbox").find(".file").attr("data-mode"),
            })
            .success(function () {
                _this.refresh();
                $(".modalbox .close").trigger('click');
            })
            .error(function (e) {
                console.log(e.responseText.substring(0,300));
            });
    },
    unstage: function (path,row) {
        $.post("/git/stage/",{path:path})
            .success(function () {
                $(row).attr("data-status","Stage");
                $(row).appendTo($("#state ul:eq(1)"));
                $(row).data().contextMenu="stage_menu";
                if ($("button.commit").hasClass("disable")) {
                    $("button.commit").attr("data-action","commitModal");
                    $("button.commit").removeClass("disable");
                }
            })
            .error(function (e) {
                console.log(e.responseText.substring(0,300));
            });
    },
    stage: function (path,row) {
        $.post("/git/unstage/",{path:path})
            .success(function () {
                $(row).attr("data-status","Unstage");
                $(row).appendTo($("#state ul:eq(0)"));
                $(row).data().contextMenu="unstage_menu";
                if ($("#state ul:eq(1) li").length == 0) {
                    $("button.commit").addClass("disable");
                    $("button.commit").removeAttr("data-action")
                }
            })
            .error(function (e) {
                console.log(e.responseText.substring(0,300));
            });
    },
    diff: function (args) {
        $("#details .changes").html("Loading...");
        $.post("/git/diff/", {path:args.path, commit:args.commit, status:args.status, mode:args.mode})
            .success(function (diff_details) {
                $("#details .changes").html(diff_details);
            })
            .error(function (e) {
                $("#details .changes").html(ERR);
                console.log(e.responseText.substring(0,300));
            });
    },
    diff_stat: function (commit) {
        $("#details .changes").html("Loading...");
        $.post("/git/diff_stat/",{commit:commit})
            .success(function (diff_stat) {
                $("#details .changes").html(diff_stat);
            })
            .error(function (e) {
                $("#details .changes").html(ERR);
                console.log(e.responseText.substring(0,300));
            });
    },
    wait: function () {
        $("body, button, a, select, label, header").css("cursor","wait");
        $.extend(GITJ.wait,{
            end: function () {
                $("body, select, label, header").css("cursor","default");
                $("button, a").css("cursor","pointer");
            }
        });
    },
    commit: function () {
        if (MUTEX()) return; MUTEX.on();
        var _this = this;
        var message = $("#commitbox textarea").val();
        $.post("/git/commit/",{message:message})
            .success(function (commit_li) {
                $("#commitbox textarea").val("");
                _this.refresh();
                _this.modalClose();
            })
            .error(function (e) {
                console.log(e.responseText.substring(0,300));
            })
            .complete(function () {
                $("#pullbox footer button").removeClass("disable");
                MUTEX.off();
            });
    },
    pull: function () {
        if (MUTEX()) return; MUTEX.on();
        var _this = this;
        var remote = $("#pullbox #remote option:selected").val();
        var branch = $("#pullbox #branch option:selected").val().split("/")[1];
        $("#pullbox .result").text("Running...");
        $("#pullbox footer button").addClass("disable")
        $.post("/git/pull/", {'remote':remote,'branch':branch})
            .success(function (message) {
                _this.refresh();
                var re = /([0-9]+\sfiles?\schanged,\s[0-9]+\sinsertions?\(\+\),\s[0-9]+\sdeletions?\(-\))/;
                message = message.replace(/\n/g,"<br>");
                if (message.match(re)) {
                    var aux = message.split(re);
                    message = "<a href='#' onClick='GITJ.pull.details()'>See details</a><br><em class='blue'>"+message.match(re)[0]+"</em><br>"+aux[2];
                    //TODO: remove unnecesary extend
                    $.extend(GITJ.pull, {
                        details:function(){
                            var result = $("#pullbox .result")
                                .html().replace(/<a.+>See\sdetails<\/a>/,"");
                            $("#pullbox .result").html(aux[0]+result);
                        }
                    });
                }
                // Highlight
                message = message.replace("returned exit status 1","<b class='red'>returned exit status 1</b>");
                message = message.replace("[rejected]","<b class='red'>[rejected]</b>");
                message = message.replace("Already up-to-date","<em class='green'>Already up-to-date</em>");
                message = message.replace(/create\s/g,"<em class='green'>create </em>");
                message = message.replace(/delete\s/g,"<em class='red'>delete </em>");
                message = message.replace(/rename\s/g,"<em class='blue'>rename </em>");
                $("#pullbox .result").html(message);
            })
            .error(function (e) {
                $("#pullbox .result").text(ERR);
                console.log(e.responseText.substring(0,300));
            })
            .complete(function () {
                $("#pullbox footer button").removeClass("disable");
                MUTEX.off();
            });
    },
    push: function () {
        if (MUTEX()) return; MUTEX.on();
        var _this = this;
        var remote = $("#pushbox #remote option:selected").val();
        var branch = $("#pushbox #branch option:selected").val().split("/")[1];
        $("#pushbox .result").text("Running...");
        $("#pushbox footer button").addClass("disable");
        $.post("/git/push/", {'remote':remote,'branch':branch})
            .success(function (message) {
                _this.refresh();
                message = message.replace("returned exit status 1","<b class='red'>returned exit status 1</b>");
                message = message.replace("[rejected]","<b style='color:red'>[rejected]</b>");
                message = message.replace(/\n/g,"<br>");
                $("#pushbox .result").html(message);
            })
            .error(function (e) {
                $("#pushbox .result").text(ERR);
                console.log(e.responseText.substring(0,300));
            })
            .complete(function () {
                $("#pushbox footer button").removeClass("disable");
                MUTEX.off();
            });
    },
    newBranchModal: function () {
        this.modal("#newbranchbox");
    },
    openRepoModal: function () {
        this.modal("#openrepobox");
    },
    commitModal: function () {
        this.modal("#commitbox");
    },
    pullModal: function () {
        $("#pullbox #remote").trigger('change');
        this.modal("#pullbox");
    },
    pushModal: function () {
        $("#pushbox #remote").trigger('change');
        this.modal("#pushbox");
    },
    configModal: function () {
        this.modal("#configbox");
    },
    profileModal: function (name, email) {

        if (!FB_TOKEN)
            $.getJSON("https://graph.facebook.com/oauth/authorize",{
                'type':'user_agent',
                'client_id':'195535300518293',
                'redirect_uri':'http://localhost:8080/',
                'scope':'user_photos,email,user_birthday,user_online_presence'
            },function (data) {console.log(data)});

        $("#profilebox .author-name").text(name);
        $("#profilebox .author-email").text(email);

        $.getJSON("https://graph.facebook.com/search", {
            'q':email,
            'type':'user',
            'access_token':'AAACEdEose0cBAKfbEZApkkXIdU5jUbcFt1utfKFrpKnZBJVgLsAOCFOVMUTL7liMmPSnxPWf5bznCsJcJOPKDZC62mZAfRW2tsL04S4zsgZDZD',
        }, function (graph) {
            var id = graph.data[0].id;
            $.getJSON("https://graph.facebook.com/", {
                'id':id,
                'access_token':'AAACEdEose0cBAKfbEZApkkXIdU5jUbcFt1utfKFrpKnZBJVgLsAOCFOVMUTL7liMmPSnxPWf5bznCsJcJOPKDZC62mZAfRW2tsL04S4zsgZDZD',
            }, function (profile) {
                console.log(profile);
                $("#profilebox .fb-name").text(profile.name);
                $("#profilebox .fb-gender").text(profile.gender);
                $("#profilebox .fb-link").text(profile.link);
                $("#profilebox .fb-locale").text(profile.locale);
                $("#profilebox .fb-timezone").text(profile.timezone);
                $("#profilebox .fb-username").text(profile.username);
                var works = "";
                for (var i in profile.work) {
                    works += "<br>";
                    var p = profile.work[i];
                    if (p.employer)
                        works += "<b>"+p.employer.name+"</b>";
                    if (p.description)
                        works += " | "+p.description;
                    if (p.location)
                        works += " | "+p.location.name;
                    if (p.position)
                        works += " | "+p.position.name;
                    if (p.start_date)
                        works += " | "+p.start_date;
                    if (p.end_date)
                        works += " | "+p.end_date;
                }
                if (works.length)
                    $("#profilebox .fb-works").html(works);
                var education = "";
                for (var i in profile.education) {
                    education += "<br>";
                    var p = profile.education[i];
                    if (p.school)
                        education += "<b>"+p.school.name+"</b>";
                    if (p.year)
                        education += " | "+p.year.name;
                    if (p.type)
                        education += " | "+p.type;
                    if (p.concentration)
                        education += " | "+p.concentration[0].name;
                }
                if (education.length)
                    $("#profilebox .fb-education").html(education);
            });
        });

        this.modal("#profilebox");
    },
    gitignoreModal: function (path) {
        $("#gitignorebox .paths p:nth-child(1) input").val(path);
        $("#gitignorebox .paths p:nth-child(1) label").text(path);
        $("#gitignorebox .paths p:nth-child(2) input").val(path.replace(/^[^\.]+/,"*"));
        $("#gitignorebox .paths p:nth-child(2) label").text(path.replace(/^[^\.]+/,"*"));
        $("#gitignorebox .paths p:nth-child(3) input").val(path.replace(/[^\/]+$/,"*"));
        $("#gitignorebox .paths p:nth-child(3) label").text(path.replace(/[^\/]+$/,"*"));
        this.modal("#gitignorebox");
    },
    addtogitignore: function () {
        var value = $("[name=gitignorepath]:checked").val();
        alert(value);
    },
    openMergetool: function () {
        if (MUTEX()) return;
        MUTEX.on();
        $.post("/git/merge/")
            .success(function (message) {
                $("#pullbox .result").html(message);
            })
            .error(function (e) {
                $("#pullbox .result").html(e.statusText);
                console.log(e);
            })
            .complete(function () {
                MUTEX.off();
            });
    },
    createbranch: function () {
        var name = $("div#newbranchbox input[name=branch]").val();
        if (name.length==0 || MUTEX()) return;

        MUTEX.on();
        var _this = this;
        $("#newbranchbox footer button").addClass("disable")
        $.post("/git/create_branch", {'name':name})
            .success(function (message) {
                //_this.refresh();
                message = message.replace("exit status 128","<b class='red'>exit status 128</b>");
                $("#newbranchbox .result").html(message);
                if (message == "Ok")
                    _this.refreshAll();
            })
            .error(function (e) {
                $("#newbranchbox .result").text(ERR);
                console.error(e.responseText.substring(0,300));
            })
            .complete(function () {
                $("#newbranchbox footer button").removeClass("disable");
                MUTEX.off();
            });
    },
    drawGraph: function () {
        var color = "gray";
        var waitingList = [];
        var tree = [];
        var lastColumn = 0;

        var findColumn = function (node, suggestedColumn) {
            var column = undefined;
            $.each(waitingList, function (index, element) {
                if ( element.node == node ) {
                    column = element.branch;
                    return;
                }
            });

            if (!column && !suggestedColumn) {
                lastColumn += 1;
                return lastColumn;
            }
            else if (!column) return suggestedColumn;
            else if (!suggestedColumn) return column;
            else {
                lastColumn -= 1;
                return column>suggestedColumn?suggestedColumn:column;
            }
        }

        var addNode = function (node,parents) {
            var column = findColumn(node);
            tree.push({'node':node, 'branch':column, 'parents':parents});
            return column;
        }

        var toQueue = function (node, suggestedColumn) {
            column = findColumn(node, suggestedColumn);
            waitingList.push({'node':node, 'branch':column});
        }

        $.each($(".point"), function (index, point) {
            var node = $(this).attr("id");
            if ($(this).data().targets.__proto__.constructor.name != "String") return;
            var parents = jsonifyTargets(this);
            var column = addNode(node,parents);
            toQueue(parents[0].target, column);
            if (parents[1]) toQueue(parents[1].target);

            $(this).css('margin-left',(10*column)+"px");

        });

        // Show Branchs
        $.getJSON("/git/get_heads_with_commit/",
            function(heads) {
                for (i in heads) {
                    $("[data-hexsha='"+heads[i][1]+"'] .tags")
                        .append("<span class='head' data-context-menu='branch_menu'>"+heads[i][0]+"</span>");
                }
            });
    },
    unimplemented: function () {
        alert('unimplemented :(');
    },
    exit: function () {
        $.get("/exit/");
    }
}

$(document).ready(function(){GITJ.init()});

function jsonifyTargets(a) {return JSON.parse($(a).data().targets.replace(/\"/g,"__").replace(/\'/g,"\"").replace(/__/g,"\'"));}