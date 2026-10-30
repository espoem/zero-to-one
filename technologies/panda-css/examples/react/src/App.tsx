import { useState } from 'react'
import { css } from '../styled-system/css'
import { Box, Flex, Stack } from '../styled-system/jsx'
import { Alert } from './Alert.tsx'
import { Badge } from './Badge.tsx'
import { Button } from './Button.tsx'

const cardBody = css({ display: 'flex', flexDirection: 'column', '@card/wide': { flexDirection: 'row' } })

export function App() {
  const [dark, setDark] = useState(false)
  return (
    <Box className={dark ? 'dark' : undefined} bg="bg.canvas" color="fg.default" p="6" data-testid="page">
      <Stack gap="4">
        <Flex gap="2">
          <Button data-testid="solid" onClick={() => setDark((d) => !d)}>
            Toggle dark
          </Button>
          <Button data-testid="outline-lg" visual="outline" size="lg">
            Outline lg
          </Button>
          <Button data-testid="override" visual="outline" size="lg" css={{ borderWidth: '4px', bg: 'brand.900' }}>
            css() beats recipes
          </Button>
        </Flex>

        <Badge data-testid="badge" tone="brand" css={{ fontWeight: 'bold' }}>
          new
        </Badge>

        <Alert.Root status="danger" data-testid="alert">
          <Alert.Title data-testid="alert-title">Payment failed</Alert.Title>
          <Alert.Description>Check the card details.</Alert.Description>
        </Alert.Root>

        <div className={css({ containerType: 'inline-size', containerName: 'card', w: '[18rem]' })}>
          <div data-testid="cq-narrow" className={cardBody} />
        </div>
        <div className={css({ containerType: 'inline-size', containerName: 'card', w: '[48rem]' })}>
          <div data-testid="cq-wide" className={cardBody} />
        </div>

        {/* NEGATIVE: concatenated classes; the stylesheet order, not string order, decides. */}
        <p data-testid="concat" className={`${css({ color: 'orange.700' })} ${css({ color: 'orange.300' })}`}>
          concatenated
        </p>
        <p data-testid="merged" className={css({ color: 'orange.700' }, { color: 'orange.300' })}>
          merged
        </p>
      </Stack>
    </Box>
  )
}
