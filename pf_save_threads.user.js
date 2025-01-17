// ==UserScript==
// @name         ProgrammersForum Save Threads
// @namespace    programmersforum.ru
// @version      1.6.3
// @description  adds exportThreads function to export the specified threads, and loadThreadsList to get IDs of all threads in the specified category
// @author       Alex P
// @include      *programmersforum.ru/*
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.15/lodash.min.js
// @require      https://unpkg.com/axios/dist/axios.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.2.2/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.2/dist/FileSaver.min.js
// @grant        none
// @downloadURL  https://github.com/AlexP11223/ProgForumRuUserscripts/raw/master/pf_save_threads.user.js
// ==/UserScript==

(function () {
    'use strict';

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function parseHtml(html) {
        return new DOMParser().parseFromString(html, 'text/html')
    }

    function parseThread(html) {
        const htmlDoc = parseHtml(html);

        const pageCountBar = htmlDoc.querySelector('.pagenav .vbmenu_control');

        const posts = htmlDoc.querySelector('#posts');

        const pollForm = htmlDoc.querySelector('form[action^="poll.php"]');
        const pollImg = htmlDoc.querySelector('img[src*="/polls/"]');
        const pollResults = pollImg ? pollImg.closest('table') : null;
        const pollResultsLink = htmlDoc.querySelector('a[href^="poll.php?do=showresults"]');

        return {
            head: htmlDoc.head.innerHTML,
            content: posts.innerHTML,
            additionalContent: [pollForm, pollResults].map(el => el ? el.outerHTML : '').join('\n'),
            pollResultsUrl: pollResultsLink ? pollResultsLink.href : null,
            title: htmlDoc.querySelector('.navbar strong').textContent.trim(),
            categories: Array.from(htmlDoc.querySelectorAll('.navbar a[href^=forumdisplay]')).map(el => el.textContent.trim()),
            pageCount: pageCountBar ? parseInt(pageCountBar.textContent.split(' ')[3]) : 1,
        };
    }

    function threadUrl(threadId) {
        return `/showthread.php?t=${threadId}`;
    }

    function generateThreadPagesUrls(threadId, pageCount) {
        const firstPageUrl = threadUrl(threadId);
        return [firstPageUrl, ..._.range(2, pageCount + 1, 1).map(n => `${firstPageUrl}&page=${n}`)];
    }

    async function loadPollResults(url) {
        console.log(`Loading ${url}`);
        const htmlDoc = parseHtml(await $.get(url));

        const pollImg = htmlDoc.querySelector('img[src*="/polls/"]');
        return pollImg ? pollImg.closest('table').outerHTML : '';
    }

    function loadImageBase64(url) {
        console.log(`Loading ${url}`);
        return axios.get(url, {responseType: 'arraybuffer'})
            .then(response => `data:${response.headers['content-type']};base64,${btoa(new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), ''))}`);
    }

    function loadFile(url) {
        console.log(`Loading ${url}`);
        return axios.get(url, {responseType: 'blob'})
            .then(response => response.data);
    }

    const imgCache = new Map();

    async function replaceRemoteImages(html) {
        const htmlDoc = parseHtml(html);

        const imgs = [
            ...htmlDoc.querySelectorAll('a[href^="member.php"] img[src*="u="]'),
            ...htmlDoc.querySelectorAll('img[src*="attachmentid="]'),
            ...htmlDoc.querySelectorAll('img[src^="images/smilies/"]'),
            ...htmlDoc.querySelectorAll('img[src*="/polls/"]'),
            ...htmlDoc.querySelectorAll('img[src$="clear.gif"]'),
        ];
        const imgUrls = imgs.map(img => img.src);

        for (const imgUrl of imgUrls) {
            if (!imgCache.has(imgUrl)) {
                try {
                    imgCache.set(imgUrl, await loadImageBase64(imgUrl));
                } catch (e) {
                    console.error(e);
                }
            }
        }

        for (const img of imgs) {
            const localUrl = imgCache.get(img.src);
            if (localUrl) {
                img.src = localUrl;
            }
        }

        return htmlDoc.body.innerHTML;
    }

    function getLocalAttachmentPath(attachment) {
        return `attachments/${attachment.id} ${attachment.name}`;
    }

    async function loadAttachments(html) {
        const htmlDoc = parseHtml(html);

        const attachmentLinks = [
            ...htmlDoc.body.querySelectorAll('a[href*="attachmentid"]:not([rel])'),
        ];

        let attachments = [];
        for (const link of attachmentLinks) {
            await sleep(_.random(1000, 3000));

            try {
                const id = new URL(link.href, location.origin).searchParams.get('attachmentid');
                const attachment = {
                    id,
                    name: sanitizeFileName(link.textContent),
                    blob: await loadFile(link.href),
                };
                attachments.push(attachment);

                link.href = getLocalAttachmentPath(attachment);
            } catch (e) {
                console.error(e);
            }
        }

        return [htmlDoc.body.innerHTML, attachments];
    }

    async function loadThread(id) {
        console.log(`Loading ${threadUrl(id)}`);
        const firstPage = parseThread(await $.get(threadUrl(id)));

        console.log(`${firstPage.title} (${firstPage.pageCount} pages)`);

        await sleep(_.random(1000, 3000));

        let pages = [firstPage];
        for (const url of generateThreadPagesUrls(id, firstPage.pageCount).slice(1)) {
            await sleep(_.random(1000, 3000));

            console.log(`Loading ${url}`);
            pages.push(parseThread(await $.get(url)));
        }

        let pollDetailedResults = '';
        if (pages[0].pollResultsUrl) {
            try {
                pollDetailedResults = await loadPollResults(pages[0].pollResultsUrl);
            } catch (e) {
                console.error(e);
            }
        }

        const head = pages[0].head.replace('windows-1251', 'utf-8');

        const postsHtml = `${pages[0].additionalContent}${pollDetailedResults}<div id="posts">${pages.map(p => p.content).join('')}</div>`;
        const postsHtmlWithImages = await replaceRemoteImages(postsHtml);
        const [postsHtmlWithImagesAndAttachments, attachments] = await loadAttachments(postsHtmlWithImages);

        return {
            id,
            title: firstPage.title,
            categories: firstPage.categories,
            pageCount: firstPage.pageCount,
            attachments,
            html: `<!DOCTYPE html>
<html lang="ru">
<head>
${head}
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/AlexP11223/ProgForumRuUserscripts/dist/vbulletin_important.min.css" />
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/AlexP11223/ProgForumRuUserscripts/non-user-js/highlight/styles/programmersforum.css" />
<style type="text/css">
    img[src^="images/1070/"],
    img[src="images/icons/icon1.gif"]
    { display: none; }
</style>
</head>
<body>
<h2>${firstPage.categories.join(' - ')}</h2>
<h1>${firstPage.title}</h1>
${postsHtmlWithImagesAndAttachments}

<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/AlexP11223/ProgForumRuUserscripts/non-user-js/video_embed.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/AlexP11223/ProgForumRuUserscripts/non-user-js/highlight/dist/highlight.pack.js"></script>
<script src="https://cdn.jsdelivr.net/gh/AlexP11223/ProgForumRuUserscripts/non-user-js/highlight/code_highlighter.min.js"></script>
<script>
    codehighlighter.init();
    videoembed.init({hideLinks: true});
</script>
</body></html>`,
        };
    }

    function sanitizeFileName(input, replacement = ' ') {
        return _.truncate(input, {length: 100, omission: ''})
            .replace(/[\/\?<>\\:\*\|"]/g, replacement);
    }

    window.exportThreads = async function (...ids) {
        const zip = new JSZip();

        const ZIP_ROOT = 'programmersforum_export/';

        for (const id of ids) {
            const thread = await loadThread(id);

            const fileName = `${thread.id} ${sanitizeFileName(_.truncate(thread.title, {length: 100}))}.html`;
            const path = thread.categories.map(sanitizeFileName).join('/');
            zip.file(`${ZIP_ROOT}${path}/${fileName}`, thread.html);

            for (const attachment of thread.attachments) {
                zip.file(`${ZIP_ROOT}${path}/${getLocalAttachmentPath(attachment)}`, attachment.blob);
            }
        }

        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        });
        saveAs(zipBlob, 'threads.zip');
    };

    window.loadThreadsList = async function (forumId) {
        await $.get('/archive/index.php?pda=1');

        const startUrl = `/archive/index.php/f-${forumId}.html`;

        console.log(`Loading ${startUrl}`);
        const firstPageHtmlDoc = parseHtml(await $.get(startUrl));

        const nextUrls = Array.from(firstPageHtmlDoc.body.querySelectorAll('a[href*="-p-"]')).map(a => a.href);

        let htmlDocs = [firstPageHtmlDoc];
        for (const url of nextUrls) {
            await sleep(_.random(1000, 3000));

            console.log(`Loading ${url}`);
            htmlDocs.push(parseHtml(await $.get(url)));
        }

        return _.flatten(htmlDocs.map(d => Array.from(d.body.querySelectorAll('li a')).map(a => a.href)))
            .map(url => url.split('-').slice(-1)[0].split('.')[0]);
    };
})();
