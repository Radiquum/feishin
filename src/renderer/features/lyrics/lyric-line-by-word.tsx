import { TitleProps } from '@mantine/core';
import { createPolymorphicComponent, Title as MantineHeader } from '@mantine/core';
import { ComponentPropsWithoutRef, ReactNode } from 'react';
import styled from 'styled-components';

import { TextTitle } from '/@/renderer/components/text-title';
import { SynchronizedLyricsKaraokeTokenObject } from '/@/shared/types/domain-types';
interface LyricLineProps extends ComponentPropsWithoutRef<'div'> {
    alignment: 'center' | 'left' | 'right';
    fontSize: number;
    handleSeek: (timestamp: number) => void;
    id: string;
    tokens: SynchronizedLyricsKaraokeTokenObject[];
}

// const StyledText = styled(TextTitle)<TitleProps & { $alignment: string; $fontSize: number }>`
//     padding: 0 1rem;
//     font-size: ${(props) => props.$fontSize}px;
//     font-weight: 600;
//     color: var(--main-fg);
//     text-align: ${(props) => props.$alignment};
//     opacity: 0.5;

//     transition:
//         opacity 0.3s ease-in-out,
//         transform 0.3s ease-in-out;

//     &.active {
//         opacity: 1;
//     }

//     &.unsynchronized {
//         opacity: 1;
//     }

//     &.synchronized {
//         cursor: pointer;
//     }
// `;

// const StyledSpan = styled(TextTitle)<TitleProps & { $alignment: string; $fontSize: number }>`
//     padding: 0 1rem;
//     font-size: ${(props) => props.$fontSize}px;
//     font-weight: 600;
//     color: var(--main-fg);
//     text-align: ${(props) => props.$alignment};
//     opacity: 0.5;

//     transition:
//         opacity 0.3s ease-in-out,
//         transform 0.3s ease-in-out;

//     &.active {
//         opacity: 1;
//     }

//     &.unsynchronized {
//         opacity: 1;
//     }

//     &.synchronized {
//         cursor: pointer;
//     }
// `;

type SpanProps = ComponentPropsWithoutRef<'span'>;
interface SpanPropsProps extends SpanProps {
    $link?: boolean;
    $noSelect?: boolean;
    $secondary?: boolean;
    children?: ReactNode;
    overflow?: 'hidden' | 'visible';
    to?: string;
    weight?: number;
}

const _Span = ({ children, ...rest }: SpanProps) => {
    return <span {...rest}>{children}</span>;
};

const Span = createPolymorphicComponent<'span', SpanPropsProps>(_Span);
const StyledSpan = styled(Span)<TitleProps & { $alignment: string; $fontSize: number }>`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: ${(props) =>
        props.$alignment == 'left'
            ? 'flex-start'
            : (props) => (props.$alignment == 'right' ? 'flex-end' : 'center')};
    padding: 0 1rem;
    font-size: ${(props) => props.$fontSize}px;
    font-weight: 600;
`;

const StyledText = styled(TextTitle)<TitleProps>`
    width: 'fit-content';
    font-weight: 600;
    color: var(--main-fg);
    opacity: 0.5;

    transition:
        opacity 0.3s ease-in-out,
        transform 0.3s ease-in-out;

    &.active {
        opacity: 1;
    }

    &.unsynchronized {
        opacity: 1;
    }

    &.synchronized {
        cursor: pointer;
    }
`;

export const LyricLineByWord = ({
    alignment,
    fontSize,
    handleSeek,
    id,
    tokens,
    ...props
}: LyricLineProps) => {
    return (
        <StyledSpan
            $alignment={alignment}
            $fontSize={fontSize}
            id={id}
        >
            {tokens.map((token) => {
                return (
                    <StyledText
                        id={`${id}-token-${token.index}`}
                        key={`${id}-token-${token.index}`}
                        onClick={() => handleSeek(token.timestamp / 1000)}
                        {...props}
                    >
                        {token.text}
                    </StyledText>
                );
            })}
        </StyledSpan>
    );
};
