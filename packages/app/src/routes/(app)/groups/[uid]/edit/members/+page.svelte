<script lang="ts">
  import ButtonSecondary from '$lib/components/ButtonSecondary.svelte';
  import Fuse from 'fuse.js';
  import IconSearch from '~icons/mdi/search';
  import IconAdd from '~icons/mdi/add';
  import IconBulkAddMembers from '~icons/mdi/account-multiple-plus-outline';
  import InputText from '$lib/components/InputText.svelte';
  import { zeus } from '$lib/zeus';
  import type { PageData } from './$types';
  import AvatarPerson from '$lib/components/AvatarPerson.svelte';
  import InputCheckbox from '$lib/components/InputCheckbox.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import { isBefore } from 'date-fns';
  import InputPerson from '$lib/components/InputPerson.svelte';
  import InputField from '$lib/components/InputField.svelte';
  import { isOnClubBoard, roleEmojis } from '$lib/permissions';
  import InputSelectOne from '$lib/components/InputSelectOne.svelte';
  import IconDownload from '~icons/mdi/download-outline';
  import { page } from '$app/stores';
  import { format } from 'date-fns';
  import { toasts } from '$lib/toasts';

  export let data: PageData;
  const { group } = data;

  let updatingMember: {
    memberId: string;
    president: boolean;
    treasurer: boolean;
    vicePresident: boolean;
    secretary: boolean;
    title: string;
    canEditArticles: boolean;
    canEditMembers: boolean;
    canScanEvents: boolean;
  } = {
    memberId: '',
    president: false,
    treasurer: false,
    vicePresident: false,
    secretary: false,
    title: '',
    canEditArticles: false,
    canEditMembers: false,
    canScanEvents: false,
  };

  let serverError = '';
  let search = '';
  let promo = '1A';
  let newMemberUid = '';
  let newMemberTitle = '';

  async function csv() {
    const { groupMembersCsv } = await $zeus.query({
      groupMembersCsv: [
        { groupUid: $page.params.uid },
        {
          '__typename': true,
          '...on Error': { message: true },
          '...on QueryGroupMembersCsvSuccess': { data: true },
        },
      ],
    });

    if (groupMembersCsv.__typename === 'Error') {
      toasts.error("Erreur lors de l'export CSV", groupMembersCsv.message);
      return;
    }

    return groupMembersCsv.data;
  }

  const addGroupMember = async () => {
    const { addGroupMember } = await $zeus.mutate({
      addGroupMember: [
        { groupUid: group.uid, uid: newMemberUid, title: newMemberTitle },
        {
          '__typename': true,
          '...on Error': {
            message: true,
          },
          '...on MutationAddGroupMemberSuccess': {
            data: {
              memberId: true,
              createdAt: true,
              title: true,
              president: true,
              treasurer: true,
              secretary: true,
              vicePresident: true,
              canEditMembers: true,
              canEditArticles: true,
              canScanEvents: true,
              member: {
                uid: true,
                firstName: true,
                lastName: true,
                pictureFile: true,
                fullName: true,
                yearTier: true,
                contributesTo: {
                  uid: true,
                },
              },
            },
          },
        },
      ],
    });
    if (addGroupMember.__typename === 'Error') {
      serverError = addGroupMember.message;
    } else {
      newMemberUid = '';
      newMemberTitle = '';
      // XXX for some reason the date is returned as a datestring
      addGroupMember.data.createdAt = new Date(addGroupMember.data.createdAt);
      data.group.members = [...data.group.members, addGroupMember.data];
    }
  };

  const deleteGroupMember = async (memberId: string) => {
    try {
      await $zeus.mutate({
        deleteGroupMember: [{ groupId: group.id, memberId }, true],
      });
      data.group.members = data.group.members.filter((member) => member.memberId !== memberId);
    } catch (error: unknown) {
      toasts.error(`Impossible de virer ce membre`, error?.toString());
    }
  };

  const updateGroupMember = async (memberId: string) => {
    const member = group.members.find((member) => member.memberId === memberId);
    try {
      if (!member) throw new Error('Member not found');
      const updateData = { ...member, ...updatingMember };
      const { upsertGroupMember } = await $zeus.mutate({
        upsertGroupMember: [
          {
            groupId: data.group.id,
            memberId,
            title: updateData.title,
            president: updateData.president,
            treasurer: updateData.treasurer,
            vicePresident: updateData.vicePresident,
            secretary: updateData.secretary,
            canEditArticles: updateData.canEditArticles,
            canEditMembers: updateData.canEditMembers,
            canScanEvents: updateData.canScanEvents,
          },
          {
            title: true,
            president: true,
            treasurer: true,
            vicePresident: true,
            secretary: true,
            canEditArticles: true,
            canEditMembers: true,
            canScanEvents: true,
          },
        ],
      });
      data.group.members = group.members.map((member) =>
        member.memberId === memberId
          ? { ...member, ...upsertGroupMember }
          : {
              ...member,
              president: upsertGroupMember.president ? false : member.president,
            },
      );
      updatingMember.memberId = '';
    } catch (error: unknown) {
      toasts.error(`Impossible de changer @${member?.member.uid ?? '?'}`, error?.toString());
    }
  };

  function membersByImportance(
    a: (typeof data.group.members)[number],
    b: (typeof data.group.members)[number],
  ): 1 | -1 | 0 {
    // President first, then treasurer, then vice-president, then secretary, then the rest, by date added
    if (a.president && !b.president) return -1;
    if (!a.president && b.president) return 1;
    if (a.treasurer && !b.treasurer) return -1;
    if (!a.treasurer && b.treasurer) return 1;
    if (a.vicePresident && !b.vicePresident) return -1;
    if (!a.vicePresident && b.vicePresident) return 1;
    if (a.secretary && !b.secretary) return -1;
    if (!a.secretary && b.secretary) return 1;
    if (!a.canEditMembers && b.canEditMembers) return 1;
    if (a.canEditMembers && !b.canEditMembers) return -1;
    if (a.canScanEvents && !b.canScanEvents) return -1;
    if (!a.canScanEvents && b.canScanEvents) return 1;
    if (a.canEditArticles && !b.canEditArticles) return -1;
    if (!a.canEditArticles && b.canEditArticles) return 1;
    return isBefore(a.createdAt, b.createdAt) ? 1 : -1;
  }

  let searcher: Fuse<(typeof data.group.members)[number]>;
  $: searcher = new Fuse(
    data.group.members.filter(({ member: { yearTier } }) =>
      promo === 'Vieux' ? yearTier >= 5 : promo === `${yearTier}A`,
    ),
    {
      keys: [
        'member.fullName',
        'member.lastName',
        'member.firstName',
        'member.uid',
        'title',
        'memberId',
      ],
      shouldSort: true,
    },
  );

  function shownMembers(
    search: string,
    promo: string,
    members: Array<(typeof data.group.members)[number]>,
  ) {
    return search && searcher
      ? searcher.search(search).map(({ item }) => item)
      : members
          .filter(({ member: { yearTier } }) =>
            promo === 'Vieux' ? yearTier >= 5 : `${yearTier}A` === promo,
          )
          .sort(membersByImportance);
  }
</script>

<section class="search">
  <div class="actions">
    {#await csv()}
      <ButtonSecondary icon={IconDownload} loading>Exporter en .csv</ButtonSecondary>
    {:then csvContents}
      <ButtonSecondary
        icon={IconDownload}
        href="data:application/octet-stream;charset=utf-8,{encodeURIComponent(csvContents ?? '')}"
        download={`membres-${$page.params.uid}-${format(new Date(), "yyyy-MM-dd-HH'h'mm")}.csv`}
        >Exporter en .csv</ButtonSecondary
      >
    {/await}
  </div>
  <InputSelectOne options={['1A', '2A', '3A', '4A', 'Vieux']} label="Promo" bind:value={promo} />
  <InputText bind:value={search} label="Rechercher">
    <svelte:fragment slot="before">
      <IconSearch />
    </svelte:fragment>
  </InputText>
</section>

<ul class="nobullet members">
  {#each shownMembers(search, promo, data.group.members) as { memberId, member, president, treasurer, vicePresident, secretary, title, canEditArticles, canEditMembers, canScanEvents } (memberId)}
    <li>
      <div class="item" data-id={member.uid}>
        <AvatarPerson
          href="/users/{member.uid}"
          {...member}
          fullName="{member.fullName} {roleEmojis({
            president,
            treasurer,
            vicePresident,
            secretary,
          })}"
          role={title}
          permissions={isOnClubBoard({ president, treasurer, vicePresident, secretary })
            ? undefined
            : { canEditArticles, canEditMembers, canScanEvents }}
        >
          {title}
          {#if data.group.studentAssociation && !member.contributesTo.some((c) => c.uid === data.group.studentAssociation?.uid)}
            <strong class="not-contributor">
              &bull; non cotisant à {data.group.studentAssociation?.name}</strong
            >
          {/if}
        </AvatarPerson>
        <div class="actions">
          {#if updatingMember.memberId === memberId}
            <ButtonSecondary
              on:click={async () => {
                await updateGroupMember(memberId);
              }}>Terminer</ButtonSecondary
            >
          {:else}
            <ButtonSecondary
              on:click={() => {
                updatingMember = {
                  president,
                  treasurer,
                  vicePresident,
                  secretary,
                  canEditArticles,
                  canEditMembers,
                  canScanEvents,
                  title,
                  memberId,
                };
              }}>Modifier</ButtonSecondary
            >
          {/if}
          <ButtonSecondary
            danger
            disabled={president || treasurer}
            title={president || treasurer
              ? `Nommez quelqu'un d'autre commme ${
                  president
                    ? 'président·e'
                    : treasurer
                      ? 'trésorier·e'
                      : 'président·e et trésorièr·e'
                }`
              : ''}
            on:click={async () => {
              await deleteGroupMember(memberId);
            }}>Virer</ButtonSecondary
          >
        </div>
      </div>
      <form
        class:open={updatingMember.memberId === memberId}
        on:submit|preventDefault={async () => {
          await updateGroupMember(memberId);
        }}
        class="edit"
        data-id={member.uid}
      >
        <InputText label="Titre" bind:value={updatingMember.title} />
        <div class="roles">
          <InputField label="Bureau">
            <div class="checkboxes">
              <InputCheckbox label="Président·e" bind:value={updatingMember.president} />
              <InputCheckbox label="Trésorier·e" bind:value={updatingMember.treasurer} />
              <InputCheckbox label="Vice-président·e" bind:value={updatingMember.vicePresident} />
              <InputCheckbox label="Secrétaire" bind:value={updatingMember.secretary} />
            </div>
          </InputField>
          <InputField label="Permissions">
            <div class="checkboxes">
              <InputCheckbox
                label="Gère les articles/évènements"
                bind:value={updatingMember.canEditArticles}
              />
              <InputCheckbox label="Gère les membres" bind:value={updatingMember.canEditMembers} />
              <InputCheckbox
                label="Peut scanner tous les billets"
                bind:value={updatingMember.canScanEvents}
              />
            </div>
          </InputField>
        </div>
      </form>
    </li>
  {/each}
</ul>

<form class="add-member" on:submit|preventDefault={addGroupMember}>
  <h2>
    Ajouter un membre
    <ButtonSecondary icon={IconBulkAddMembers} insideProse href="./bulk"
      >Ajouter en masse</ButtonSecondary
    >
  </h2>
  <InputPerson
    except={data.group.members.map(({ member: { uid } }) => uid)}
    required
    label="Utilisateur·ice"
    bind:uid={newMemberUid}
  />
  <InputText label="Titre" bind:value={newMemberTitle} />
  {#if serverError}
    <Alert theme="danger">{serverError}</Alert>
  {/if}
  <section class="submit">
    <ButtonSecondary submits icon={IconAdd}>Ajouter</ButtonSecondary>
  </section>
</form>

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    margin: 2rem 0 1rem;
  }

  form.add-member {
    display: flex;
    flex-flow: column wrap;
    gap: 1rem;
    margin-top: 3rem;
  }

  .members {
    display: flex;
    flex-flow: column;
    gap: 0.5rem;
    max-height: 45vh;
    margin-top: 2rem;
    overflow: auto;
  }

  .members .item {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .members form {
    display: flex;
    flex-flow: column wrap;
    gap: 1rem;
  }

  .members .edit {
    display: flex;
    flex-flow: column;
    gap: 1rem;
    max-height: 0;
    overflow-y: hidden;
    border: none;
    border-radius: var(--radius-block);
    transition: max-height 0.25s ease;
  }

  .members .edit.open {
    max-height: 30rem;
    padding: 1rem;
    border: var(--border-block) solid var(--border);
  }

  .members .checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .members .roles {
    display: flex;
    flex-flow: row wrap;
    gap: 1rem;
  }

  .not-contributor {
    color: var(--danger-link);
  }

  .search {
    margin-bottom: 1rem;
  }

  @media (max-width: 500px) {
    .members .item {
      flex-direction: column;
    }

    .members .item .actions {
      align-self: center;
      margin-top: 0.3rem;
    }
  }
</style>
