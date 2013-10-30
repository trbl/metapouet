var PouetAPI = function () {

    var PROXY_PREPEND = "http://metapouet.net/proxy/?url=http%3A%2F%2F",
        POUET_USERPAGE = PROXY_PREPEND + "www.pouet.net/user.php?who=",
        //POUET_DEMOBLOG = PROXY_PREPEND + encodeURIComponent("www.pouet.net/user.php?show=demoblog&com=-1&nothumbsup=&nopiggies=1&nothumbsdown=1&who="),
        POUET_XNFO = PROXY_PREPEND + "www.pouet.net/export/prod.xnfo.php?which=";

    var _userInfoList = [],
        _commentedProds = [];

    var _eventList = {
        "complete": function () {
        }
    };

    function getDemoBlogURL(rateDown, rateMeh, rateUp){

        var baseURL = "www.pouet.net/user.php?show=demoblog&com=-1";

            baseURL += "&nothumbsup=" + (rateUp ? '' : '1');
            baseURL += "&nopiggies=" + (rateMeh ? '' : '1');
            baseURL += "&nothumbsdown=" + (rateDown ? '' : '1');
            baseURL += '&who=';

        return PROXY_PREPEND + encodeURIComponent(baseURL);
    }

    function setEvent(evtName, functionName) {
        _eventList[evtName] = functionName;
    }

    function getUserPageBuddies(idx, node) {

        var dude = $(node).find('.usera'),
            name = dude.attr('title'),
            pouetID = dude.attr('href').split('=')[1],
            prodsInCommon = parseInt($(node).text().split(' (')[1].split('prods)')[0], 10),
            avatar = dude.find('img.avatar').attr('data-src');

        return {"name": name, "pouetID": pouetID, "avatar": avatar, "prodsInCommon": prodsInCommon};
    }

    function parseUserPage(html) {

        var base = $(html),
            userRow = base.find('#pouetbox_usermain h2'),
            thumbUpBuddyRows = base.find('div.contribheader:contains("top thumb up agreers")').next(),
            thumbDownBuddyRows = base.find('div.contribheader:contains("top thumb down agreers")').next();

        var buddies = [],
            cdc = base.find('#userdata .prod>a').map(
                function () {
                    $(this).attr('href').split('=')[1], 10;
                }
            );

        buddies['up'] = $.makeArray(thumbUpBuddyRows.find('li').map(getUserPageBuddies));
        buddies['down'] = $.makeArray(thumbDownBuddyRows.find('li').map(getUserPageBuddies));

        return {
            "thumb": buddies,
            "name": userRow.find('span:eq(0)').text(),
            "avatar": userRow.find('img[alt^="avatar"]').attr('data-src'),
            "cdc": $.makeArray(cdc),
            "gloeps": parseInt(userRow.find('span:eq(1) span').text(), 10)
        };
    }

    function getDemoblogPlatformList(idx, node) {
        return $(node).attr('title');
    }

    function getDemoblogGroupList(idx, node) {
        return {
            "pouetID": $(node).attr('href').split('=')[1],
            "name": $(node).text()
        };
    }

    function parseDemoBlog(html) {

        var base = $(html),
            //so some lists in comments escape their parent - thus destroying this search - shield by using classNames
            commentRows = base.find('#demoblog>li[class]'),
            prodsCommented = [];

        for (var i = 0; i < commentRows.length; i += 3) {

            var prodRow = commentRows.eq(i),
                voteRow = commentRows.eq(i + 2),
                type = prodRow.find('.typeiconlist .typei').map(getDemoblogPlatformList);

            //currently pouet can throw a error midway of the demoblog, so let's stop collecting if that happens
            if(prodRow.find('a[href^="prod.php?which="]').attr('href')) {


                var prodID = prodRow.find('a[href^="prod.php?which="]').attr('href').split('=')[1],
                    prodName = prodRow.find('a[href^="prod.php?which="]').text(),
                    groupList = prodRow.find('a[href^="groups.php?which="]').map(getDemoblogGroupList),
                    vote = voteRow.find('.vote').text(),
                    date = voteRow.text().split('added on the ')[1];

                //make vote range from -1 to 1 instead of 'rulez', 'oink' and 'sucks'
                vote = (vote == 'rulez') ? 1 : ((vote == 'sucks') ? -1 : 0);

                prodsCommented.push({
                    "type": $.makeArray(type),
                    "pouetID": prodID,
                    "prodName": prodName,
                    "group": $.makeArray(groupList),
                    "vote": vote,
                    "date": date
                });
            }
        }

        return prodsCommented;
    }

    //as we can't load all comments at once, we load them one by one - otherwise pouet spits a php error :\
    function scrapeDemoBlog(pouetID, callback){
        getURL(getDemoBlogURL(true, false, false) + pouetID, function (demoBlogHTML) {
            _commentedProds[pouetID] = parseDemoBlog(demoBlogHTML);

            getURL(getDemoBlogURL(false, true, false) + pouetID, function (demoBlogHTML) {
                _commentedProds[pouetID] = _commentedProds[pouetID].concat(parseDemoBlog(demoBlogHTML));

                getURL(getDemoBlogURL(false, false, true) + pouetID, function (demoBlogHTML) {
                    _commentedProds[pouetID] = _commentedProds[pouetID].concat(parseDemoBlog(demoBlogHTML));

                    callback(_commentedProds[pouetID]);
                });
            });
        });
    }

    function getCommentedProds(pouetID, callback) {

        if (_commentedProds[pouetID]) {
            callback(_commentedProds[pouetID]);
        } else {
            scrapeDemoBlog(pouetID, callback);
        }
    }

    var _prodData = [];
    function getProdInfo(pouetID, callback){
        if(_prodData[pouetID]){
            callback(_prodData[pouetID]);
        } else {
            getURL(POUET_XNFO + pouetID, function (xnfo) {

                _prodData[pouetID] = {};
                _prodData[pouetID].screenshot = $(xnfo).find('screenshot url').text();

                callback(_prodData[pouetID]);
            });
        }
    }

    function getUserInfo(pouetID, callback) {

        //check if we got the info already, no need to stress the server
        if (_userInfoList[pouetID]) {
            callback(_userInfoList[pouetID]);
        } else {
            getURL(POUET_USERPAGE + pouetID, function (userPageHTML) {
                _userInfoList[pouetID] = parseUserPage(userPageHTML);
                callback(_userInfoList[pouetID]);
            });
        }
    }

    function getURL(uri, callback) {

        $.ajax({
            url: uri,
            dataType: "html",
            //dataType: 'json',
            success: function (response) {
                var modResponse = response.replace(/src=/g, "data-src=");
                callback(modResponse);
            }
        });
    }

    return {
        on: setEvent,
        getUserInfo: getUserInfo,
        getProdList: getCommentedProds,
        getProdInfo:getProdInfo
    };
};