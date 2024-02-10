<script lang="ts">
  import { page } from '$app/stores';
  import { fullsizePage } from '$lib/../routes/(app)/+layout.svelte';
  import NavigationTabs from '$lib/components/NavigationTabs.svelte';
  import { me } from '$lib/session';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  $: ({ group, uid } = $page.params);

  export let data: PageData;
  const TABS = {
    '': 'Infos',
    'registrations': 'Places',
    'scan': 'Vérifier',
  } as const;

  function manager():
    | undefined
    | { canEdit: boolean; canEditPermissions: boolean; canVerifyRegistrations: boolean } {
    return data.event.managers.find((m) => m.user.uid === $me?.uid);
  }

  onMount(() => {
    $fullsizePage = true;
    return () => {
      $fullsizePage = false;
    };
  });

  const shownTabs = ['', 'registrations', 'scan'].filter((tab) => {
    switch (tab) {
      case '': {
        return true;
      }

      case 'scan': {
        return Boolean(
          $me?.admin ||
            manager()?.canVerifyRegistrations ||
            data.event.group.members.some((m) => m.member.uid === $me?.uid && m.canScanEvents),
        );
      }

      case 'registrations': {
        return Boolean($me?.admin || manager());
      }

      default: {
        return false;
      }
    }
  }) as Array<keyof typeof TABS>;

  let pathLeaf = '';
  $: pathLeaf = $page.url.pathname.replace(/\/$/, '').split('/').pop() || '';

  let currentTab: keyof typeof TABS = '';
  $: {
    currentTab = pathLeaf in TABS ? (pathLeaf as keyof typeof TABS) : '';
  }

  const tabHref = (tab: string) => `/events/${group}/${uid}/${tab}`;
</script>

<section class="tabs">
  {#if shownTabs.length > 1}
    <NavigationTabs
      --text={currentTab === 'scan' ? 'white' : 'var(--text)'}
      tabs={shownTabs.map((tab) => ({
        name: TABS[tab],
        href: currentTab === tab ? '.' : tabHref(tab),
      }))}
    />
  {/if}
</section>

<slot />

<style>
  section.tabs {
    margin: 0 1.5rem;
  }
</style>
