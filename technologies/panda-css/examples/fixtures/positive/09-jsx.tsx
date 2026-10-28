// Module 09: JSX style props are extracted from the element, the `css` prop and
// recipe-backed JSX components listed in the recipe's `jsx` array.
import { Box, Stack, styled } from '../styled-system/jsx'

const Title = styled('h2', { base: { fontSize: '3xl', fontWeight: 'black' } })

export function Panel() {
  return (
    <Stack gap="6">
      <Title>Hello</Title>
      <Box bg="bg.subtle" p="5" css={{ borderRadius: 'xl' }} />
      <styled.p color="fg.muted" _hover={{ color: 'fg.default' }}>Body</styled.p>
    </Stack>
  )
}
