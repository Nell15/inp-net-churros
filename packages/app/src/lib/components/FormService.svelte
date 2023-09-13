<script lang="ts">
  import { LogoSourceType, zeus } from '$lib/zeus';
  import Alert from '$lib/components/Alert.svelte';
  import { goto } from '$app/navigation';
  import InputGroup from './InputGroup.svelte';
  import InputText from './InputText.svelte';
  import ButtonPrimary from './ButtonPrimary.svelte';
  import InputSchool from './InputSchool.svelte';

  export let service: {
    id?: string;
    name: string;
    description: string;
    url: string;
    logo: string;
    logoSourceType: LogoSourceType;
    school?: { uid: string; name: string; color: string };
    studentAssociation?: { uid?: string };
    group?: { uid: string };
  } = { name: '', description: '', url: '', logo: '', logoSourceType: LogoSourceType.Icon };

  let serverError = '';

  let loading = false;
  const updateService = async () => {
    if (loading) return;
    try {
      loading = true;
      const { upsertService } = await $zeus.mutate({
        upsertService: [
          {
            id: service.id,
            name: service.name,
            url: service.url,
            description: service.description,
            logo: service.logo,
            logoSourceType: service.logoSourceType,
            groupUid: service.group?.uid,
            schoolUid: service.school?.uid,
            studentAssociationUid: service.studentAssociation?.uid,
          },
          {
            __typename: true,
            '...on Error': { message: true },
            '...on MutationUpsertServiceSuccess': {
              data: {
                id: true,
                name: true,
                url: true,
                description: true,
                logo: true,
                logoSourceType: true,
                group: { uid: true },
                school: { uid: true, name: true, color: true },
                studentAssociation: { uid: true },
              },
            },
          },
        ],
      });

      if (upsertService.__typename === 'Error') {
        serverError = upsertService.message;
        return;
      }

      serverError = '';
      service = upsertService.data;
      if (service.id) await goto(`/services/${service.id}/edit`);
    } finally {
      loading = false;
    }
  };
</script>

<form on:submit|preventDefault={updateService}>
  <InputSchool label="École" uid={service.school?.uid} bind:object={service.school} />
  <InputText required label="Nom" bind:value={service.name} maxlength={255} />
  <InputText required label="URL" bind:value={service.url} maxlength={255} />
  <InputText label="Description" bind:value={service.description} />
  <InputGroup clearable label="Groupe" uid={service.group?.uid} />
  {#if serverError}
    <Alert theme="danger"
      >Impossible de sauvegarder les modifications : <br /><strong>{serverError}</strong></Alert
    >
  {/if}
  <section class="submit">
    <ButtonPrimary submits {loading}>Sauvegarder</ButtonPrimary>
  </section>
</form>

<style>
  form {
    display: flex;
    flex-flow: column wrap;
    gap: 2rem;
  }

  section.submit {
    display: flex;
    justify-content: center;
  }
</style>