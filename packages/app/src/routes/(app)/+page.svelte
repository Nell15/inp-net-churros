<script lang="ts">
  import CardArticle from '$lib/components/CardArticle.svelte';
  import { zeus } from '$lib/zeus';
  import type { PageData } from './$types';
  import { _eventQuery, _pageQuery } from './+page';
  import { env } from '$env/dynamic/public';
  import CarouselGroups from '$lib/components/CarouselGroups.svelte';
  import { me } from '$lib/session';
  import AvatarPerson from '$lib/components/AvatarPerson.svelte';
  import InputSelectOne from '$lib/components/InputSelectOne.svelte';
  import ButtonSecondary from '$lib/components/ButtonSecondary.svelte';
  import CardFeedEvent from '$lib/components/CardFeedEvent.svelte';
  import { onMount } from 'svelte';

  export let data: PageData;

  let loading = false;
  let selectedBirthdaysYearTier = 'all';
  onMount(() => {
    selectedBirthdaysYearTier = $me?.yearTier
      ? $me.yearTier <= 3
        ? $me.yearTier.toString()
        : 'all'
      : 'all';
  });
  const loadMore = async () => {
    if (loading) return;
    try {
      loading = true;
      const { homepage, events } = await $zeus.query({
        homepage: [{ after: data.homepage.pageInfo.endCursor }, _pageQuery],
        events: [{ after: data.events.pageInfo.endCursor }, _eventQuery],
      });
      data.homepage.pageInfo = homepage.pageInfo;
      data.homepage.edges = [...data.homepage.edges, ...homepage.edges];
      data.events.pageInfo = events.pageInfo;
      data.events.edges = [...data.events.edges, ...events.edges];
    } finally {
      loading = false;
    }
  };

  type HomepageItem =
    | {
        id: string;
        article: (typeof data.homepage.edges)[0]['node'];
        event: undefined;
      }
    | {
        id: string;
        event: (typeof data.events.edges)[0]['node'];
        article: undefined;
      };

  function itemDate(item: HomepageItem): Date | undefined {
    return item.article?.publishedAt ?? item.event?.startsAt;
  }

  function homepageItems(
    articles: typeof data.homepage.edges,
    events: typeof data.events.edges,
  ): HomepageItem[] {
    return [
      ...articles.map(({ node }) => ({ id: node.id, article: node, event: undefined })),
      ...events.map(({ node }) => ({ id: node.id, article: undefined, event: node })),
    ].sort((a, b) => itemDate(b)!.getTime() - itemDate(a)!.getTime());
  }
</script>

<h1>Mon feed</h1>

<section class="groups">
  {#if $me?.groups}
    <CarouselGroups groups={$me.groups.map(({ group }) => group)} />
  {/if}
</section>

{#if data.birthdays}
  <section class="birthdays">
    <h2>
      Anniversaires
      <InputSelectOne
        bind:value={selectedBirthdaysYearTier}
        label=""
        options={{ 1: '1As', 2: '2As', 3: '3As', all: 'Tous' }}
      />
      <ButtonSecondary href="/birthdays">Autres jours</ButtonSecondary>
    </h2>
    <ul class="nobullet">
      {#each data.birthdays.filter((u) => selectedBirthdaysYearTier === 'all' || u.yearTier === Number.parseFloat(selectedBirthdaysYearTier)) as { uid, major, birthday, ...user } (uid)}
        <li>
          <AvatarPerson
            href="/users/{uid}"
            {...user}
            role="{major?.shortName ?? '(exté)'} · {new Date().getFullYear() -
              (birthday?.getFullYear() ?? 0)} ans"
          />
        </li>
      {:else}
        <li>
          {#if selectedBirthdaysYearTier === 'all'}
            Personne n'est né aujourd'hui :/
          {:else}
            Aucun·e {selectedBirthdaysYearTier}A n'est né·e aujourd'hui :/
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<section class="articles">
  {#each homepageItems(data.homepage.edges, data.events.edges) as item (item.id)}
    {#if item.article}
      {@const { id, uid, pictureFile, group, reactionCounts, myReactions, event, ...rest } =
        item.article}
      <CardArticle
        {...rest}
        {id}
        {group}
        likes={reactionCounts['❤️'] ?? 0}
        liked={myReactions['❤️']}
        event={event ? { href: `/events/${event.group.uid}/${event.uid}`, ...event } : undefined}
        href="/posts/{group.uid}/{uid}/"
        img={pictureFile ? { src: `${env.PUBLIC_STORAGE_URL}${pictureFile}` } : undefined}
      />
    {:else}
      {@const { uid, reactionCounts, myReactions, ...event } = item.event}
      <CardFeedEvent
        href="/events/{event.group.uid}/{uid}"
        likes={reactionCounts['❤️']}
        liked={myReactions['❤️']}
        {...event}
      ></CardFeedEvent>
    {/if}
  {/each}
</section>

{#if data.homepage.pageInfo.hasNextPage}
  <section class="see-more">
    <ButtonSecondary on:click={loadMore} {loading}>Voir plus</ButtonSecondary>
  </section>
{/if}

<style>
  h1 {
    margin-bottom: 1rem;
    text-align: center;
  }

  section.groups {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  section.articles {
    display: flex;
    flex-direction: column;
    row-gap: 2rem;
    max-width: 600px;
    margin: 2rem auto 0;
  }

  section.birthdays h2 {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: center;
  }

  section.birthdays ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    justify-content: center;
    margin-top: 1rem;
  }

  section.birthdays {
    display: flex;
    flex-flow: column wrap;
    align-items: center;
    max-width: 600px;
    margin: 0 auto;
  }

  .see-more {
    display: flex;
    justify-content: center;
  }
</style>
