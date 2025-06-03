import {
    SynchronizedLyricsArray,
    SynchronizedLyricsKaraokeLineArray,
    SynchronizedLyricsKaraokeTokenObject,
} from '/@/shared/types/domain-types';

const wordTimestampRegex = /<\d{2}:\d{2}\.\d{2,3}>/gm;
export function elrcParse(lyrics: SynchronizedLyricsArray) {
    const lyricLines: SynchronizedLyricsKaraokeLineArray = [];
    lyrics.forEach((line, line_index) => {
        const tokensArray: SynchronizedLyricsKaraokeTokenObject[] = [];
        const timestamps = line[1].match(wordTimestampRegex) || [];
        const words = line[1].replaceAll(wordTimestampRegex, '||SPLIT||').split('||SPLIT||');

        // Always push the first word, since it's timestamp is a start of the line
        tokensArray.push({
            index: 0,
            text: words[0],
            timestamp: line[0],
        });

        words.forEach((text, text_index) => {
            if (
                text_index != 0 &&
                timestamps.length >= text_index &&
                timestamps[text_index] != undefined
            ) {
                // This part assumes that format of the word timestamp is always <mm:ss.xx(x)>
                // According to the Wikipedia page, this should be always true
                const time = timestamps[text_index].replace('<', '').replace('>', '');
                const minutes = Number(time.split(':')[0]);
                const seconds = Number(time.split(':')[1]);
                const ms = minutes * 60 * 1000 + seconds * 1000;
                tokensArray.push({
                    index: text_index,
                    text: text,
                    timestamp: ms,
                });
            }
        });

        // Push the collected tokens as a line
        lyricLines.push({
            index: line_index,
            timestamp: line[0], // Similar to line[line_index].tokens[0].timestamp
            tokens: tokensArray,
        });
    });

    // Return the parsed lines
    return lyricLines;
}
