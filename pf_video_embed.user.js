// ==UserScript==
// @name         ProgrammersForumVideoEmbed
// @namespace    http://programmersforum.ru/
// @version      0.3
// @description  replaces youtube and coub links with embedded video player frames
// @author       Alex P
// @include      http://programmersforum.ru/*
// @include      http://www.programmersforum.ru/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @grant        none
// @downloadURL  https://github.com/AlexP11223/ProgForumRuUserscripts/raw/master/pf_video_embed.user.js
// ==/UserScript==

(function() {
    'use strict';

    var YOUTUBE_EMBED_TEMPLATE = '<iframe src="https://www.youtube.com/embed/_ID_" width="560" height="315" frameborder="0" allowfullscreen></iframe>';
    var COUB_EMBED_TEMPLATE = '<iframe src="//coub.com/embed/_ID_?muted=false&autostart=false&originalSize=false&startWithHD=true" width="640" height="270" frameborder="0" allowfullscreen></iframe>';

    function insertEmbed(origLinkNode, embedTemplate, id) {
        var html = '<br/>' + embedTemplate.replace('_ID_', id) + '<br/>';

        $(html).insertBefore(origLinkNode);
        origLinkNode.hide();
    }

    function parseURL(url) {
        var parser = document.createElement('a');
        var searchDict = {};

        parser.href = url;

        var queries = parser.search.replace(/^\?/, '').split('&');
        var i;
        for (i = 0; i < queries.length; i++) {
            var parts = queries[i].split('=');
            searchDict[parts[0]] = parts[1];
        }

        return {
            protocol: parser.protocol,
            host: parser.host,
            hostname: parser.hostname,
            port: parser.port,
            pathname: parser.pathname,
            search: parser.search,
            hash: parser.hash,
            searchDict: searchDict,
            pathParts: parser.pathname.substring(1).split('/')
        };
    }

    function containsAny(str, substrings) {
        for (var i = 0; i != substrings.length; i++) {
            var substring = substrings[i];
            if (str.indexOf(substring) != -1) {
                return true;
            }
        }
        return false;
    }

    function parseYoutubeId(href) {
        var url = parseURL(href);

        var domains = ['youtube.com', 'youtu.be'];

        if (!containsAny(url.hostname, domains))
            return false;

        if (url.hostname.indexOf('youtu.be') != -1)
            return url.pathParts[0];

        if (url.searchDict['v'])
            return url.searchDict['v'];

        if (['watch', 'embed', 'v'].indexOf(url.pathParts[0]) != -1)
            return url.pathParts[1];

        return false;
    }

    function parseCoubId(href) {
        var url = parseURL(href);

        var domains = ['coub.com'];

        if (!containsAny(url.hostname, domains))
            return false;

        if (['view', 'embed'].indexOf(url.pathParts[0]) != -1)
            return url.pathParts[1];

        return false;
    }

    var postBlocks = $('#posts, #post, td.alt1:has(hr)');

    $.each(postBlocks.find('a[href*="youtu"], a[href*="coub"]'), function (i, link) {
        if (!$(link).is(':visible'))
            return;

        // skip signature
        if ($(link).parents('div').eq(0).is(':contains("__________________")'))
            return;

        var url = $(link).attr('href');

        var youtubeId = parseYoutubeId(url);
        if (youtubeId) {
            insertEmbed($(link), YOUTUBE_EMBED_TEMPLATE, youtubeId);
        }

        var coubId = parseCoubId(url);
        if (coubId) {
            insertEmbed($(link), COUB_EMBED_TEMPLATE, coubId);
        }
    });
})();
