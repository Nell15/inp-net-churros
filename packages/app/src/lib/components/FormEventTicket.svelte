<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ButtonSecondary from './ButtonSecondary.svelte';
  import InputCheckbox from './InputCheckbox.svelte';
  import InputDate from './InputDate.svelte';
  import InputField from './InputField.svelte';
  import InputNumber from './InputNumber.svelte';
  import InputText from './InputText.svelte';
  import ButtonGhost from './ButtonGhost.svelte';
  import IconChevronDown from '~icons/mdi/chevron-down';
  import IconChevronUp from '~icons/mdi/chevron-up';
  import InputSearchObjectList from './InputSearchObjectList.svelte';
  import { type PaymentMethod, zeus } from '$lib/zeus';
  import Fuse from 'fuse.js';
  import { fromYearTier, schoolYearStart, yearRangeUpTo, yearTier } from '$lib/dates';
  import InputSelectMultiple from './InputSelectMultiple.svelte';
  import { DISPLAY_PAYMENT_METHODS } from '$lib/display';
  import InputLinks from './InputLinks.svelte';
  import InputGroups from './InputGroups.svelte';
  import InputSchools from './InputSchools.svelte';
  const emit = createEventDispatcher();

  export let expandedTicketId = '';
  let showNameHint = false;

  function promoLabel(year: number) {
    return `${yearTier(year)}A (${year})`;
  }

  export let ticket: {
    id: string;
    name: string;
    description: string;
    opensAt?: Date | undefined;
    closesAt?: Date | undefined;
    price: number;
    capacity: number;
    openToPromotions: number[];
    links: Array<{ value: string; name: string }>;
    openToSchools: Array<{ name: string; id: string; uid: string }>;
    openToGroups: Array<{
      name: string;
      uid: string;
      id: string;
      pictureFile: string;
      pictureFileDark: string;
    }>;
    openToMajors: Array<{ name: string; shortName: string; id: string }>;
    openToExternal?: boolean | null | undefined;
    openToAlumni?: boolean | null | undefined;
    openToContributors?: boolean | null | undefined;
    openToApprentices?: boolean | null | undefined;
    godsonLimit: number;
    onlyManagersCanProvide: boolean;
    autojoinGroups: Array<{
      name: string;
      uid: string;
      id: string;
      pictureFile: string;
      pictureFileDark: string;
    }>;
    allowedPaymentMethods: PaymentMethod[];
  };

  export let allGroups: typeof ticket.openToGroups;

  $: expanded = expandedTicketId === ticket.id;

  $: displayCapacity =
    ticket.capacity === 0
      ? 'Places illimitées'
      : `${ticket.capacity} place${ticket.capacity > 1 ? 's' : ''}`;
</script>

<article class="ticket" data-id={ticket.id} class:expanded>
  <header>
    <div class="properties">
      <span class="name">{ticket.name}</span>
      <span class="prix">{ticket.price}€</span>
      <span class="capacity">{displayCapacity}</span>
    </div>
    <div class="actions">
      <ButtonSecondary
        on:click={() => {
          expandedTicketId = '';
          emit('delete');
        }}
        danger>Supprimer</ButtonSecondary
      >
      <ButtonGhost
        class="toggle-expanded"
        on:click={() => {
          expandedTicketId = expanded ? '' : ticket.id;
        }}
      >
        {#if expanded}
          <IconChevronUp />
        {:else}
          <IconChevronDown />
        {/if}
      </ButtonGhost>
    </div>
  </header>
  {#if expanded}
    <InputText
      hint={showNameHint ? "Pas besoin de mettre 'place' ou 'billet' devant le nom" : undefined}
      on:input={(e) => {
        if (!(e.detail.target instanceof HTMLInputElement)) return;
        ticket.name = e.detail.target.value.replace(/^\s*(ticket|billet|place)\b\s*(\S)/i, '$2');
        if (ticket.name !== e.detail.target.value) showNameHint = true;
      }}
      required
      maxlength={255}
      label="Nom"
      value={ticket.name}
    />

    <div class="side-by-side">
      <InputNumber label="Prix" bind:value={ticket.price} />
      <InputNumber label="Nombre de places" bind:value={ticket.capacity} />
    </div>

    <InputText label="Description" maxlength={255} bind:value={ticket.description} />

    <div class="side-by-side">
      <InputDate time label="Date du shotgun" bind:value={ticket.opensAt} />
      <InputDate time label="Clôture" bind:value={ticket.closesAt} />
    </div>

    <InputField label="Promos">
      <ButtonSecondary
        on:click={() => {
          ticket.openToPromotions = [1, 2, 3].map((y) => fromYearTier(y));
        }}>1+2+3As</ButtonSecondary
      >
      <ButtonSecondary
        on:click={() => {
          ticket.openToPromotions = [fromYearTier(1)];
        }}>1As</ButtonSecondary
      >
      <InputSearchObjectList
        search={(q) => {
          const range = yearRangeUpTo(schoolYearStart().getFullYear() + 4, 10);
          return new Fuse(
            range.map((year) => ({
              value: year,
              label: promoLabel(year),
            })),
            { keys: ['label'] },
          )
            .search(q)
            .map(({ item }) => item);
        }}
        valueKey="value"
        labelKey="label"
        bind:values={ticket.openToPromotions}
        objects={ticket.openToPromotions.map((year) => ({
          value: year,
          label: promoLabel(year),
        }))}
      />
    </InputField>

    <InputGroups
      placeholder="Aucune restriction"
      multiple
      options={allGroups}
      label="Groupes"
      clearButtonLabel="Tous"
      bind:groups={ticket.openToGroups}
    />

    <InputSchools
      label="Ecoles"
      placeholder="Aucune contrainte"
      clearButtonLabel="Toutes"
      multiple
      bind:schools={ticket.openToSchools}
    ></InputSchools>

    <InputField label="Filières">
      <InputSearchObjectList
        search={async (query) => {
          const { majors } = await $zeus.query({
            majors: {
              name: true,
              shortName: true,
              id: true,
            },
          });
          const searcher = new Fuse(majors, { keys: ['name', 'shortName'] });
          return searcher.search(query).map((r) => r.item);
        }}
        labelKey="shortName"
        valueKey="id"
        values={ticket.openToMajors.map((r) => r.id)}
        bind:objects={ticket.openToMajors}
      />
    </InputField>

    <div class="conditions">
      <InputCheckbox
        labelFalse="Interdit"
        labelNull="Autorisés"
        labelTrue="Seulement"
        label="Extés"
        ternary
        bind:value={ticket.openToExternal}
      />
      <InputCheckbox
        labelFalse="Interdit"
        labelNull="Autorisés"
        labelTrue="Seulement"
        label="Alumnis"
        ternary
        bind:value={ticket.openToAlumni}
      />
      <InputCheckbox
        labelFalse="Interdit"
        labelNull="Autorisés"
        labelTrue="Seulement"
        label="Cotisants"
        ternary
        bind:value={ticket.openToContributors}
      />
      <InputCheckbox
        labelFalse="Interdit"
        labelNull="Autorisés"
        labelTrue="Seulement"
        label="Apprentis"
        ternary
        bind:value={ticket.openToApprentices}
      />
    </div>

    <InputLinks
      label="Liens"
      hint="Visibles une fois la place réservée"
      bind:value={ticket.links}
    />

    <InputNumber
      hint="0 signifie aucun parrainage autorisé"
      label="Limite de parrainages"
      bind:value={ticket.godsonLimit}
    />

    <InputCheckbox
      label="Seul un manager peut donner ce billet"
      bind:value={ticket.onlyManagersCanProvide}
    />

    <InputGroups
      label="Inscrire sur des groupes à la réservation"
      multiple
      bind:groups={ticket.autojoinGroups}
      options={allGroups}
    />

    <InputField label="Méthodes de paiement">
      <InputSelectMultiple
        bind:selection={ticket.allowedPaymentMethods}
        options={DISPLAY_PAYMENT_METHODS}
      />
    </InputField>

    <footer>
      <div class="properties">
        <span class="name">{ticket.name}</span>
        <span class="capacity">{displayCapacity}</span>
        <span class="prix">{ticket.price}€</span>
      </div>
      <div class="actions">
        <ButtonSecondary
          on:click={() => {
            expandedTicketId = '';
            emit('delete');
          }}
          danger>Supprimer</ButtonSecondary
        >
        <ButtonGhost
          class="toggle-expanded"
          on:click={() => {
            expandedTicketId = '';
          }}
        >
          <IconChevronUp />
        </ButtonGhost>
      </div>
    </footer>
  {/if}
</article>

<style lang="scss">
  .ticket {
    display: flex;
    flex-flow: column wrap;
    gap: 1rem;
    width: 550px;
    max-width: 100%;
    padding: 1em;
    border-radius: var(--radius-block);
    box-shadow: var(--shadow);

    :global(.toggle-expanded) {
      margin-left: auto;
    }
  }

  header,
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;

    .properties {
      display: flex;
      gap: 1rem;
    }
  }

  .side-by-side,
  .conditions {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
  }
</style>
