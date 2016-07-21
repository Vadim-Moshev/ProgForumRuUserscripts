// ==UserScript==
// @name         ProgrammersForumQuickQuote
// @namespace    http://programmersforum.ru/
// @version      0.2
// @description  adds a button to quote selected text, also changes the reply/quote button to not reload page
// @author       Alex P
// @include      http://programmersforum.ru/*
// @include      http://www.programmersforum.ru/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @grant        GM_addStyle
// @downloadURL  https://github.com/AlexP11223/ProgForumRuUserscripts/raw/master/pf_quick_quote.user.js
// ==/UserScript==

(function() {
    'use strict';

    function getSelectedText() {
        return window.getSelection().toString();
    }

    function onPostClicked(e) {
        var selectedText = $.trim(getSelectedText());
        if (selectedText) {
            qqBtn.css({ top: (e.pageY + 10) + 'px', left: e.pageX + 'px'});
            qqBtn.show();

            qqBtn.delay(3000).fadeOut();

            var postContainer = $(this).closest('table');

            currPostId = postContainer.attr('id').replace('post', '');
            currAuthorName = postContainer.find('.bigusername').first().text();

            currSelectedText = selectedText;
        }
        else {
            qqBtn.hide();
        }
    }

    function appendText(text) {
        if (vB_Editor[QR_EditorID].get_editor_contents().length > 0) {
            text = '\n' + text;
        }
        vB_Editor[QR_EditorID].insert_text(text);
        vB_Editor[QR_EditorID].collapse_selection_end();
    }

    function appendQuote(text) {
        appendText('[QUOTE=' + currAuthorName + ';' + currPostId + ']' + text + '[/QUOTE]\n');
    }

    function quoteSelected() {
        appendQuote(currSelectedText);

        qqBtn.hide();
    }

    function quotePost(postQuoteUrl, progressIndicator) {
        progressIndicator.show();

        $.get(postQuoteUrl, function(response) {
                var html = $.parseHTML(response);

                var quote = $.trim($(html).find('#vB_Editor_001_textarea').text());

                if (quote) {
                    appendText(quote);
                }
            }).done(function() {
            progressIndicator.hide();
        });
    }

    GM_addStyle('.qq-btn { z-index: 999;' +
        'position: absolute;' +
        'border: 1px solid midnightblue;' +
        'padding: 3px;' +
        'font-weight: bold;' +
        'cursor: pointer;' +
        'background-color: lightyellow; }');

    $('<div id="quick_quote_btn" class="smallfont qq-btn" style="display:none;">Цитировать</div>').prependTo($('body'));

    var qqBtn = $('#quick_quote_btn');

    qqBtn.click(quoteSelected);

    qqBtn.hover(function() {
            qqBtn.stop(true, true);
        },
        function() {
            qqBtn.delay(3000).fadeOut();
        });

    $('#posts').on('mouseup', 'div[id^="post_message"]', onPostClicked);

    var currSelectedText = '';
    var currPostId = '';
    var currAuthorName = '';


    $('#posts').find('a:has(img[src*="quote."])').click( function(e) {
        e.preventDefault();

        var url = $(this).attr('href');
        var progressIndicator = $(this).prevAll('img[id^="progress"]').first();

        quotePost(url, progressIndicator);
    });
})();
