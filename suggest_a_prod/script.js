var _suggestAProd,
    _pouetAPI = new PouetAPI();

if(location.hash && location.hash.length > 0){
    $('#pouetID').val(location.hash.split('#')[1]);
} else {
    $('#pouetID').val(26747);
}

$('#getSuggestion').on("click", init);
$("#results").on("mousedown", '.prod', function(e){
    if((e.which==1) || (e.which==2)) {
        var node = e.target;
        while(!$(node).hasClass('prod')) {
            node = $(node).parent();
        }
    }
});

function init() {
    $('#results').empty();
    $('#log').empty();

    var _prodTypes = $('#prodType :selected').map(function () {

        return $(this).text();
    }).off();

    _suggestAProd = new SuggestAProd();
    _suggestAProd.start();
}

var Pouetan = function () {

    var userId,
        userInfo,
        prodList;
};

var SuggestAProd = function () {

    var _suggestionList = [],
        _currentPouetan,
        _buddies = [],
        _prodInfo = [];

    var _friendType = $('#buddyType').val(),
        _sortType = $('#sortType').val(),
        _likeType = $('#likeType').val(),
        _prodType = $.makeArray($('#prodType :selected').map(function () {
            return $(this).text();
        }));

    var _startTime;

    function start() {

        _startTime = Date.now();

        progress("Pants dropping in progress..", 5);

        getOwnInfo();
    }

    function getOwnInfo() {

        var pouetID = $('#pouetID').val();

        location.hash = '#' + pouetID;

        _currentPouetan = new Pouetan();
        _currentPouetan.userID = $('#pouetID').val();

        _pouetAPI.getUserInfo($('#pouetID').val(), function (userInfo) {

            _currentPouetan.userInfo = userInfo;

            progress("Hey " + userInfo.name + "! You have " + userInfo.thumb[_friendType].length + " Thumb"+
                _friendType.charAt(0).toUpperCase() + _friendType.slice(1) +"Buddies.", 10);

            getOwnProdList();
        });
    }

    function getOwnProdList() {

        _pouetAPI.getProdList(_currentPouetan.userID, function (prodList) {

            _currentPouetan.prodList = prodList;

            progress("Got " + prodList.length + " comments from you on Pouet.", 15);

            getBuddies();
        });
    }

    function getBuddies() {

        progress("Starting to fetch your buddies comments", 20);

        var trackedPercentages = [];
        _currentPouetan.userInfo.thumb[_friendType].map(function (buddy, idx, collection) {

            _pouetAPI.getProdList(buddy.pouetID, function (prodList) {

                var thumbBuddy = new Pouetan();
                thumbBuddy.userInfo = buddy;
                thumbBuddy.prodList = prodList;

                _buddies.push(thumbBuddy);

                var percentage = 100 / collection.length * _buddies.length;

                if((percentage >= 25) && (trackedPercentages.indexOf(25) == -1)){
                    trackedPercentages.push(25);
                } else if((percentage >= 50) && (trackedPercentages.indexOf(50) == -1)){
                    trackedPercentages.push(50);
                } else if((percentage >= 75) && (trackedPercentages.indexOf(75) == -1)){
                    trackedPercentages.push(75);
                }

                progress("Collected " + prodList.length + " comments from " + buddy.name, 20 + (70 / collection.length * _buddies.length));

                //all buddies loaded, now build the stuff
                if (_buddies.length == collection.length)
                    buildList();
            });
        });
    }

    function buildList() {

        progress("Sorting things out..", 95);

        //reduce mine to IDs
        _currentPouetan.prodIDList = _currentPouetan.prodList.map(function (prod) {

            if(!_prodInfo[prod.pouetID])
                _prodInfo[prod.pouetID] = prod;

            return prod.pouetID;
        });

        _buddies.map(function (buddy) {

            //reduce to prods based on like/meh/more meh
            buddy.prodIDList = $.makeArray(buddy.prodList.filter(function (prod) {

                if(!_prodInfo[prod.pouetID])
                    _prodInfo[prod.pouetID] = prod;

                if ((prod.vote == _likeType) && (_prodType.indexOf(prod.type[0]) > -1))
                    return true;

                //reduce to IDs
            }).map(function (prod) {
                    return prod.pouetID;
                }));

            buddy.prodIDList.map(function (prodID) {
                //find prods that are in theirs but not mine
                if (_currentPouetan.prodIDList.indexOf(prodID) === -1) {

                    var idx = inList(_suggestionList, prodID);

                    if (idx > -1) {
                        _suggestionList[idx].buddy.push(buddy);
                        _suggestionList[idx].prodsInCommon += Number(buddy.userInfo.prodsInCommon);
                        _suggestionList[idx].similarity += Number(buddy.userInfo.similarity);

                    } else {
                        _suggestionList.push({
                            "buddy": [buddy],
                            "prodsInCommon": Number(buddy.userInfo.prodsInCommon),
                            "similarity": Number(buddy.userInfo.similarity),
                            "prodID": prodID,
                            "prodInfo":_prodInfo[prodID]});
                    }
                }
            });
        });

        sortList();

        render();
    }

    function sortList() {
        switch(_sortType) {
            case "rateWeight":
                _suggestionList.sort(sortByWeight);
                break;

            case "amount":
                _suggestionList.sort(sortBySeen);
                break;

            case "rateWeightMulti":
                _suggestionList.sort(sortByWeightMulti);
                break;
        }
    }

    function render(startAtIndex) {

        var OFFSET = startAtIndex || 0,
            MAX_ENTRIES = Math.min(OFFSET + 51, _suggestionList.length - 1);

        if (OFFSET === 0)
            progress("Fetching info of first " + (MAX_ENTRIES - OFFSET) + " prod(s) from Pouet.", 100);

        for (var idx = OFFSET; idx < MAX_ENTRIES; idx++) {

            renderProd(idx);

            progress("Onwards you travel, with " + _suggestionList.length + " prods to comment on.", 100);
        }
    }

    function renderProd(idx) {

        var pouetID = _suggestionList[idx].prodInfo.pouetID,
            //add the holder already, so we actually get sorted results
            holder = $('#results').append('<div class="prod" id="suggestion' + idx + '" pouetID="' + pouetID + '"></div>');

        _pouetAPI.getProdInfo(pouetID, function(prodInfo){
            actuallyRenderProd(idx, prodInfo);
        });
    }

    function actuallyRenderProd(idx, prodInfo){

        var base = _suggestionList[idx].prodInfo;
        $('#suggestion' + idx).html(
            '<a href="//pouet.net/prod.php?which=' + base.pouetID + '" target="_blank">' +
                '<div class="prodImage" style="background-image:url('+ prodInfo.screenshot +');">' +
                '<div class="prodMeta"><span class="prodTitle">' + base.prodName + '</span>' +
                '<span class="prodGroup">' + base.group.map(function (group) {
                return group.name;
            }).join('+') + '</span></div>' +
                '<span class="thumbBuddy">' + renderBuddies(_suggestionList[idx].buddy) + '</span>' +
                '</div>' +
                '</a>'
        );
    }

    function renderBuddies(list) {

        var output = "";

        for (var i = 0; i < list.length; i++) {
            var base = list[i].userInfo;
            output += '<img src="' + base.avatar + '" title="' + base.name + ' prods in common:' + base.prodsInCommon + ' similarity:' + base.similarity + '">';
        }

        return output;
    }

    function haveResults() {
        return (_suggestionList && _suggestionList.length && _suggestionList.length > 0);
    }

    return {
        start: start,
        more: render,
        haveResults: haveResults
    };
};

function inList(list, prodID) {
    for (var i = 0, len = list.length; i < len; i++) {
        if (list[i].prodID == prodID)
            return i;
    }

    return -1;
}

function progress(msg, percent) {
    $("#bar").css({width: percent + '%'});
    $('#log').html(msg);
}

function sortBySeen(a, b) {
    if (a.buddy.length < b.buddy.length)
        return 1;
    if (a.buddy.length > b.buddy.length)
        return -1;
    return 0;
}

function sortByWeightMulti(a, b) {

    if (a.similarity < b.similarity)
        return 1;
    if (a.similarity > b.similarity)
        return -1;
    return 0;
}

function sortByWeight(a, b) {

    if (a.prodsInCommon < b.prodsInCommon)
        return 1;
    if (a.prodsInCommon > b.prodsInCommon)
        return -1;
    return 0;
}

var currentOffset = 0;
jQuery.ias({
    container: '#results',
    item: '.prod',
    pagination: '.navigation',
    next: '#next',
    loader: 'lalalala',
    history: true,
    beforePageChange: function (scrollOffset, nextPageUrl) {
        if (_suggestAProd && _suggestAProd.haveResults()) {
            currentOffset += 51;
            _suggestAProd.more(currentOffset);
        }
        return false;
    }
});