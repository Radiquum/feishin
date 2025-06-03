import isElectron from 'is-electron';
import { useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';

import { LyricLine } from '/@/renderer/features/lyrics/lyric-line';
import { LyricLineByWord } from '/@/renderer/features/lyrics/lyric-line-by-word';
import { useScrobble } from '/@/renderer/features/player/hooks/use-scrobble';
import { PlayersRef } from '/@/renderer/features/player/ref/players-ref';
import {
    useCurrentPlayer,
    useCurrentStatus,
    useCurrentTime,
    useLyricsSettings,
    usePlaybackType,
    usePlayerData,
    useSeeked,
    useSetCurrentTime,
} from '/@/renderer/store';
import { FullLyricsMetadata, SynchronizedLyricsArray } from '/@/shared/types/domain-types';
import { PlaybackType, PlayerStatus } from '/@/shared/types/types';

const mpvPlayer = isElectron() ? window.api.mpvPlayer : null;
const utils = isElectron() ? window.api.utils : null;
const mpris = isElectron() && utils?.isLinux() ? window.api.mpris : null;

const SynchronizedLyricsContainer = styled.div<{ $gap: number }>`
    display: flex;
    flex-direction: column;
    gap: ${(props) => props.$gap || 5}px;
    width: 100%;
    height: 100%;
    padding: 10vh 0 50vh;
    overflow: scroll;
    word-break: break-word;

    -webkit-mask-image: linear-gradient(
        180deg,
        transparent 5%,
        rgb(0 0 0 / 100%) 20%,
        rgb(0 0 0 / 100%) 85%,
        transparent 95%
    );

    mask-image: linear-gradient(
        180deg,
        transparent 5%,
        rgb(0 0 0 / 100%) 20%,
        rgb(0 0 0 / 100%) 85%,
        transparent 95%
    );
    transform: translateY(-2rem);

    @media screen and (orientation: portrait) {
        padding: 5vh 0;
    }
`;

export interface SynchronizedLyricsProps extends Omit<FullLyricsMetadata, 'lyrics'> {
    lyrics: SynchronizedLyricsArray;
    translatedLyrics?: null | string;
}

export const SynchronizedLyrics = ({
    artist,
    lyrics,
    name,
    remote,
    source,
    translatedLyrics,
}: SynchronizedLyricsProps) => {
    const playersRef = PlayersRef;
    const status = useCurrentStatus();
    const playbackType = usePlaybackType();
    const playerData = usePlayerData();
    const now = useCurrentTime();
    const settings = useLyricsSettings();
    const currentPlayer = useCurrentPlayer();
    const currentPlayerRef =
        currentPlayer === 1 ? playersRef.current?.player1 : playersRef.current?.player2;
    const setCurrentTime = useSetCurrentTime();
    const { handleScrobbleFromSeek } = useScrobble();

    const handleSeek = useCallback(
        (time: number) => {
            if (playbackType === PlaybackType.LOCAL && mpvPlayer) {
                mpvPlayer.seekTo(time);
            } else {
                setCurrentTime(time, true);
                handleScrobbleFromSeek(time);
                mpris?.updateSeek(time);
                currentPlayerRef?.seekTo(time);
            }
        },
        [currentPlayerRef, handleScrobbleFromSeek, playbackType, setCurrentTime],
    );

    const seeked = useSeeked();

    // A reference to the timeout handler
    const lyricTimer = useRef<null | ReturnType<typeof setTimeout>>(null);
    const lyricInlineTimer = useRef<null | ReturnType<typeof setTimeout>>(null);

    // A reference to the lyrics. This is necessary for the
    // timers, which are not part of react necessarily, to always
    // have the most updated values
    const lyricRef = useRef<null | SynchronizedLyricsArray>(null);
    const lyricInlineRef = useRef<
        | null
        | {
              index: number;
              words: {
                  index: number;
                  timestamp: number;
                  word: string;
              }[];
          }[]
    >(null);

    // A constantly increasing value, used to tell timers that may be out of date
    // whether to proceed or stop
    const timerEpoch = useRef(0);
    const timerEpoch2 = useRef(0);

    const delayMsRef = useRef(settings.delayMs);
    const followRef = useRef(settings.follow);

    const getCurrentLyric = (timeInMs: number) => {
        if (lyricRef.current) {
            const activeLyrics = lyricRef.current;
            for (let idx = 0; idx < activeLyrics.length; idx += 1) {
                if (timeInMs <= activeLyrics[idx][0]) {
                    return idx === 0 ? idx : idx - 1;
                }
            }

            return activeLyrics.length - 1;
        }

        return -1;
    };

    const getCurrentTime = useCallback(async () => {
        if (isElectron() && playbackType !== PlaybackType.WEB) {
            if (mpvPlayer) {
                return mpvPlayer.getCurrentTime();
            }
            return 0;
        }

        if (playersRef.current === undefined) {
            return 0;
        }

        const player =
            playerData.current.player === 1
                ? playersRef.current.player1
                : playersRef.current.player2;
        const underlying = player?.getInternalPlayer();

        // If it is null, this probably means we added a new song while the lyrics tab is open
        // and the queue was previously empty
        if (!underlying) return 0;

        return underlying.currentTime;
    }, [playbackType, playersRef, playerData]);

    const setCurrentLyric = useCallback(
        (timeInMs: number, epoch?: number, targetIndex?: number) => {
            const start = performance.now();
            let nextEpoch: number;

            console.log('LineStart');

            if (epoch === undefined) {
                timerEpoch.current = (timerEpoch.current + 1) % 10000;
                nextEpoch = timerEpoch.current;
            } else if (epoch !== timerEpoch.current) {
                return;
            } else {
                nextEpoch = epoch;
            }

            console.log('LineEpoch');

            let index: number;

            if (targetIndex === undefined) {
                index = getCurrentLyric(timeInMs);
            } else {
                index = targetIndex;
            }

            console.log('LineIndex');
            console.log(targetIndex);
            console.log(getCurrentLyric(timeInMs));

            // Directly modify the dom instead of using react to prevent rerender
            document
                .querySelectorAll('.synchronized-lyrics .active')
                .forEach((node) => node.classList.remove('active'));

            console.log('lyricRef.current', lyricRef.current);
            console.log('lyricInlineRef.current', lyricInlineRef.current);
            if (index === -1) {
                console.log('LINE INDEX == -1');
                lyricRef.current = null;
                return;
            }

            console.log('LINE INDEX', index);
            const doc = document.getElementById(
                'sychronized-lyrics-scroll-container',
            ) as HTMLElement;
            const currentLyric = document.getElementById(`lyric-${index}`) as HTMLElement;
            console.log('currentLyric', currentLyric);

            const offsetTop = currentLyric?.offsetTop - doc?.clientHeight / 2 || 0;

            if (currentLyric === null) {
                console.log('LINE currentLyric == NULL');
                lyricRef.current = null;
                return;
            }

            console.log('LineActive');

            setCurrentWord(`${index}`, timeInMs);
            // currentLyric.classList.add('active');

            if (followRef.current) {
                doc?.scroll({ behavior: 'smooth', top: offsetTop });
            }

            if (index !== lyricRef.current!.length - 1) {
                const nextTime = lyricRef.current![index + 1][0];

                const elapsed = performance.now() - start;

                lyricTimer.current = setTimeout(
                    () => {
                        setCurrentLyric(nextTime, nextEpoch, index + 1);
                    },
                    nextTime - timeInMs - elapsed,
                );
            }
        },
        [],
    );

    const getCurrentWord = (lineId: string, timeInMs: number) => {
        if (lyricInlineRef.current) {
            const activeLyrics = lyricInlineRef.current[Number(lineId)];

            for (let idx = 0; idx < activeLyrics.words.length; idx += 1) {
                if (timeInMs <= activeLyrics.words[idx].timestamp) {
                    return idx === 0 ? idx : idx - 1;
                }
            }

            return activeLyrics.words.length - 1;
        }

        return -1;
    };

    const setCurrentWord = useCallback(
        (lineId: string, timeInMs: number, epoch?: number, targetIndex?: number) => {
            const start = performance.now();

            console.log('start');

            let nextEpoch: number;
            if (epoch === undefined) {
                timerEpoch2.current = (timerEpoch2.current + 1) % 10000;
                nextEpoch = timerEpoch2.current;
            } else if (epoch !== timerEpoch2.current) {
                return;
            } else {
                nextEpoch = epoch;
            }

            console.log('epoch');

            let index: number;

            if (targetIndex === undefined) {
                index = getCurrentWord(lineId, timeInMs);
            } else {
                index = targetIndex;
            }

            if (index === -1) {
                return;
            }

            console.log('index');

            // Directly modify the dom instead of using react to prevent rerender

            const currentLyric = document.querySelector(
                `#lyric-${lineId}-word-${index}`,
            ) as HTMLElement;

            // console.log(currentLyric, `#lyric-${lineId}-word-${index}`);

            // console.log(document.querySelector(`#lyric-${lineId}`)?.querySelectorAll(`h1`));
            // document
            //     .querySelector(`#lyric-${lineId}`)
            //     ?.querySelectorAll(`h1`)
            //     .forEach((node) => node.classList.remove('active'));

            currentLyric.classList.add('active');
            console.log('active');

            // if (followRef.current) {
            //     doc?.scroll({ behavior: 'smooth', top: offsetTop });
            // }

            if (
                lyricInlineRef.current &&
                index !== lyricInlineRef.current[Number(lineId)].words!.length - 1
            ) {
                const nextTime = lyricInlineRef.current![Number(lineId)].words[index].timestamp;

                const elapsed = performance.now() - start;

                console.log('timer');
                if (lyricInlineTimer.current) {
                    clearTimeout(lyricInlineTimer.current);
                }
                lyricInlineTimer.current = setTimeout(
                    () => {
                        setCurrentWord(lineId, nextTime, nextEpoch, index + 1);
                    },
                    nextTime - timeInMs - elapsed,
                );
            }
        },
        [],
    );

    function parseELRC(lyrics: SynchronizedLyricsArray) {
        const wordTimestampRegex = /<\d{2}:\d{2}\.\d{2,3}>/gm;
        const lyricsLines: any[] = [];

        lyrics.forEach((item, index) => {
            const lineLyric: any[] = [];
            const wordsTimestamps = item[1].match(wordTimestampRegex) || [];
            const words = item[1].replaceAll(wordTimestampRegex, '||SPLIT||').split('||SPLIT||');

            lineLyric.push({
                index: 0,
                timestamp: item[0],
                word: words[0],
            });

            words.forEach((word, index) => {
                if (
                    index != 0 &&
                    wordsTimestamps.length >= index &&
                    wordsTimestamps[index] != undefined
                ) {
                    const ttimestampstr = wordsTimestamps[index].replace('<', '').replace('>', '');
                    const minutes = Number(ttimestampstr.split(':')[0]);
                    const seconds = Number(ttimestampstr.split(':')[1]);
                    const ms = minutes * 60 * 1000 + seconds * 1000;

                    lineLyric.push({
                        index,
                        timestamp: ms,
                        word,
                    });
                }
            });

            lyricsLines.push({
                index,
                words: lineLyric,
            });
        });

        return lyricsLines;
    }

    useEffect(() => {
        // Copy the follow settings into a ref that can be accessed in the timeout
        followRef.current = settings.follow;
    }, [settings.follow]);

    useEffect(() => {
        // This handler is used to handle when lyrics change. It is in some sense the
        // 'primary' handler for parsing lyrics, as unlike the other callbacks, it will
        // ALSO remove listeners on close. Use the promisified getCurrentTime(), because
        // we don't want to be dependent on npw, which may not be precise
        lyricRef.current = lyrics;
        lyricInlineRef.current = parseELRC(lyrics);

        if (status === PlayerStatus.PLAYING) {
            let rejected = false;

            getCurrentTime()
                .then((timeInSec: number) => {
                    if (rejected) {
                        return false;
                    }

                    setCurrentLyric(timeInSec * 1000 - delayMsRef.current);

                    return true;
                })
                .catch(console.error);

            return () => {
                // Case 1: cleanup happens before we hear back from
                // the main process. In this case, when the promise resolves, ignore the result
                rejected = true;

                // Case 2: Cleanup happens after we hear back from main process but
                // (potentially) before the next lyric. In this case, clear the timer.
                // Do NOT do this for other cleanup functions, as it should only be done
                // when switching to a new song (or an empty one)
                if (lyricTimer.current) clearTimeout(lyricTimer.current);
                if (lyricInlineTimer.current) clearTimeout(lyricInlineTimer.current);
            };
        }

        return () => {};
    }, [getCurrentTime, lyrics, playbackType, setCurrentLyric, status]);

    useEffect(() => {
        // This handler is used to deal with changes to the current delay. If the offset
        // changes, we should immediately stop the current listening set and calculate
        // the correct one using the new offset. Afterwards, timing can be calculated like normal
        const changed = delayMsRef.current !== settings.delayMs;

        if (!changed) {
            return () => {};
        }

        if (lyricTimer.current) {
            clearTimeout(lyricTimer.current);
        }

        if (lyricInlineTimer.current) {
            clearTimeout(lyricInlineTimer.current);
        }

        let rejected = false;

        delayMsRef.current = settings.delayMs;

        getCurrentTime()
            .then((timeInSec: number) => {
                if (rejected) {
                    return false;
                }

                setCurrentLyric(timeInSec * 1000 - delayMsRef.current);

                return true;
            })
            .catch(console.error);

        return () => {
            // In the event this ends earlier, just kill the promise. Cleanup of
            // timeouts is otherwise handled by another handler
            rejected = true;
        };
    }, [getCurrentTime, setCurrentLyric, settings.delayMs]);

    useEffect(() => {
        // This handler is used specifically for dealing with seeking. In this case,
        // we assume that now is the accurate time
        if (status !== PlayerStatus.PLAYING) {
            if (lyricTimer.current) {
                clearTimeout(lyricTimer.current);
            }

            if (lyricInlineTimer.current) {
                clearTimeout(lyricInlineTimer.current);
            }

            return;
        }

        // If the time goes back to 0 and we are still playing, this suggests that
        // we may be playing the same track (repeat one). In this case, we also
        // need to restart playback
        const restarted = status === PlayerStatus.PLAYING && now === 0;
        if (!seeked && !restarted) {
            return;
        }

        if (lyricTimer.current) {
            clearTimeout(lyricTimer.current);
        }

        if (lyricInlineTimer.current) {
            clearTimeout(lyricInlineTimer.current);
        }

        setCurrentLyric(now * 1000 - delayMsRef.current);
    }, [now, seeked, setCurrentLyric, status]);

    useEffect(() => {
        // Guaranteed cleanup; stop the timer, and just in case also increment
        // the epoch to instruct any dangling timers to stop
        if (lyricTimer.current) {
            clearTimeout(lyricTimer.current);
        }

        if (lyricInlineTimer.current) {
            clearTimeout(lyricInlineTimer.current);
        }

        timerEpoch.current += 1;
    }, []);

    const hideScrollbar = () => {
        const doc = document.getElementById('sychronized-lyrics-scroll-container') as HTMLElement;
        doc.classList.add('hide-scrollbar');
    };

    const showScrollbar = () => {
        const doc = document.getElementById('sychronized-lyrics-scroll-container') as HTMLElement;
        doc.classList.remove('hide-scrollbar');
    };

    return (
        <SynchronizedLyricsContainer
            $gap={settings.gap}
            className="synchronized-lyrics overlay-scrollbar"
            id="sychronized-lyrics-scroll-container"
            onMouseEnter={showScrollbar}
            onMouseLeave={hideScrollbar}
        >
            {settings.showProvider && source && (
                <LyricLine
                    alignment={settings.alignment}
                    className="lyric-credit"
                    fontSize={settings.fontSize}
                    text={`Provided by ${source}`}
                />
            )}
            {settings.showMatch && remote && (
                <LyricLine
                    alignment={settings.alignment}
                    className="lyric-credit"
                    fontSize={settings.fontSize}
                    text={`"${name} by ${artist}"`}
                />
            )}
            {parseELRC(lyrics).map((line) => {
                return (
                    <div key={line.index}>
                        <LyricLineByWord
                            alignment={settings.alignment}
                            className="lyric-line synchronized"
                            fontSize={settings.fontSize}
                            id={`lyric-${line.index}`}
                            //   onClick={() => handleSeek(time / 1000)}
                            words={line.words}
                        />
                    </div>
                );
            })}
            {/* {lyrics.map(([time, text], idx) => (
                <div key={idx}>
                    <LyricLine
                        alignment={settings.alignment}
                        className="lyric-line synchronized"
                        fontSize={settings.fontSize}
                        id={`lyric-${idx}`}
                        onClick={() => handleSeek(time / 1000)}
                        text={text}
                    />
                    {translatedLyrics && (
                        <LyricLine
                            alignment={settings.alignment}
                            className="lyric-line synchronized translation"
                            fontSize={settings.fontSize * 0.8}
                            onClick={() => handleSeek(time / 1000)}
                            text={translatedLyrics.split('\n')[idx]}
                        />
                    )}
                </div>
            ))} */}
        </SynchronizedLyricsContainer>
    );
};
