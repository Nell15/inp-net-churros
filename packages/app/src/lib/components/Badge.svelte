<script lang="ts">
  import { tooltip } from '$lib/tooltip';
  export let theme: 'danger' | 'warning' | 'success' | 'info' = 'info';
  export let title: string | undefined = undefined;
  export let inline = false;
  import IconCheck from '~icons/mdi/check';
  import IconError from '~icons/mdi/error-outline';
  import IconWarning from '~icons/mdi/warning-outline';
</script>

<div
  {...$$restProps}
  use:tooltip={title ? { content: title, trigger: 'mouseenter focus click' } : undefined}
  class:inline
  class="badge {theme === 'info' ? 'primary' : theme}"
>
  {#if theme === 'success'}
    <IconCheck />
  {:else if theme === 'warning'}
    <IconWarning />
  {:else if theme === 'danger'}
    <IconError />
  {/if}
  <slot />
</div>

<style>
  div {
    display: inline-flex;
    gap: 0.25em;
    align-items: center;
    justify-content: center;
    padding: 0.25em 0.5em;
    font-size: 1rem;
    font-weight: normal;
    color: var(--text);
    background: var(--bg);
    border-radius: var(--radius-inline);
  }

  .inline {
    padding: 0.125em 0.25em;
    font-size: 0.9em;
  }

  div > :global(.icon) {
    width: 1.2em;
    height: 1.2em;
  }

  .inline > :global(.icon) {
    width: 1em;
    height: 1em;
  }
</style>
