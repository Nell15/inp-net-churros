<script lang="ts">
  import CalendarDay from '$lib/components/CalendarDay.svelte';
  import IconBackward from '~icons/mdi/chevron-left';
  import IconGear from '~icons/mdi/cog-outline';
  import IconForward from '~icons/mdi/chevron-right';
  import { addDays, startOfWeek, isSameDay, previousMonday, nextMonday, formatISO } from 'date-fns';
  import type { PageData } from './$types';
  import { me } from '$lib/session';
  import NavigationTabs from '$lib/components/NavigationTabs.svelte';
  import { isDark } from '$lib/theme';
  import ButtonSecondary from '$lib/components/ButtonSecondary.svelte';
  import CardEvent from '$lib/components/CardEvent.svelte';
  import { Gif } from 'svelte-tenor';
  import { groupLogoSrc } from '$lib/logos';
  import { env } from '$env/dynamic/public';
  import { afterNavigate } from '$app/navigation';
  import { formatDate } from '$lib/dates';

  export let data: PageData;

  let barWeek: typeof data.barWeekNow;
  let events: typeof data.eventsInWeek;
  $: ({ barWeekNow: barWeek, eventsInWeek: events } = data);

  let daysOfWeek: Date[] = [];
  $: daysOfWeek = Array.from({ length: 7 })
    .fill(0)
    .map((_, i) => addDays(startOfWeek(data.shownWeek, { weekStartsOn: 1 }), i));

  let expandedEventId: string | undefined = undefined;

  const canChangeBarWeek = Boolean(
    $me?.admin ||
      $me?.groups?.some(({ group: { uid } }) => env.PUBLIC_FOY_GROUPS?.split(',').includes(uid)),
  );

  afterNavigate(() => {
    const cDay = new Date();
    const daySection = document.querySelector(
      `section.day[id="${formatISO(cDay, { representation: 'date' })}"]`,
    );
    if (daySection) daySection.scrollIntoView({ behavior: 'smooth' });
  });
</script>

<div class="content">
  <NavigationTabs
    tabs={[
      { name: 'Semaine', href: '.' },
      { name: 'Planning', href: '../../planning/' },
      { name: 'Mes places', href: '/bookings' },
    ]}
  />
  <div class="navigation">
    <a href="/events/week/{formatISO(previousMonday(data.shownWeek), { representation: 'date' })}"
      ><IconBackward /> Précédente</a
    >
    <a href="/events/week/{formatISO(previousMonday(new Date()), { representation: 'date' })}">
      Aujourd'hui</a
    >
    <a href="/events/week/{formatISO(nextMonday(data.shownWeek), { representation: 'date' })}">
      Suivante <IconForward />
    </a>
  </div>

  {#if barWeek.groups.length > 0}
    <section class="bar-week">
      <div class="description">
        <p>Semaine de bar de</p>
      </div>
      <ul class="bar-week-groups">
        {#each barWeek.groups as group}
          <li class="group">
            <a href="/groups/{group.uid}"
              ><img src={groupLogoSrc($isDark, group)} alt="" />
              {group.name}</a
            >
          </li>
        {/each}
      </ul>
      {#if canChangeBarWeek}
        <ButtonSecondary href="/bar-weeks/" icon={IconGear}>Gérer</ButtonSecondary>
      {/if}
    </section>
  {/if}

  <div class="days">
    {#if events.length === 0}
      <div class="empty">
        <Gif
          gif={{
            id: '27616552',
            description: 'John Travolta confused',
            width: 220,
            height: 220,
            gif: 'https://media.tenor.com/EbyOKpncujQAAAAi/john-travolta-tra-jt-transparent.gif',
          }}
        />
        <p>
          {#if isSameDay(data.shownWeek, previousMonday(new Date()))}
            Aucun évènement pour <br /><strong>cette semaine</strong>
          {:else}
            Aucun événement pour la semaine du
            <br />
            <strong>{formatDate(data.shownWeek)}</strong>
          {/if}
        </p>
      </div>
    {:else}
      {#each daysOfWeek as day}
        <section class="day" id={formatISO(day, { representation: 'date' })}>
          <CalendarDay showMonth={new Set(daysOfWeek.map((d) => d.getMonth())).size > 1} {day} />
          <div class="events-of-day">
            {#each events.filter((e) => isSameDay(e.startsAt, day)) as event}
              <CardEvent
                collapsible
                bind:expandedEventId
                href="/events/{event.group.uid}/{event.uid}"
                {...event}
              />
            {/each}
          </div>
        </section>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  .content {
    max-width: 600px;
    padding: 0 0.5rem 4rem;
    margin: 0 auto;
  }

  .navigation {
    position: fixed;
    right: 0;
    bottom: 2rem;
    left: 0;
    z-index: 10;
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-around;
    padding: 1rem 0;
    margin-bottom: 2rem;
    color: var(--text);
    background: var(--bg);
  }

  .bar-week {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .bar-week-groups {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    list-style: none;

    a {
      display: flex;
      gap: 0.5rem;
      align-items: center;

      img {
        width: 3rem;
        height: 3rem;
        color: var(--muted-text);
        background: var(--muted-bg);
        border-radius: var(--radius-block);
        object-fit: contain;
      }
    }
  }

  .days {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: fit-content;
    min-width: calc(min(100%, 600px));
    margin: 0 auto;
  }

  .day {
    display: flex;
    gap: 1rem;
    width: 100%;

    .events-of-day {
      display: flex;
      flex-flow: column wrap;
      flex-grow: 1;
      gap: 1rem;
    }
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    margin-top: 2rem;
    margin-bottom: 4rem;
    text-align: center;
  }

  :global(.gif) {
    width: 50% !important;
    background: none !important;
  }
</style>
