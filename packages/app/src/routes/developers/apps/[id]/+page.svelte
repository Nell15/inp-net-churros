<script lang="ts">
  import Alert from '$lib/components/Alert.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import ButtonBack from '$lib/components/ButtonBack.svelte';
  import ButtonCopyToClipboard from '$lib/components/ButtonCopyToClipboard.svelte';
  import ButtonSecondary from '$lib/components/ButtonSecondary.svelte';
  import ButtonToggleShow from '$lib/components/ButtonToggleShow.svelte';
  import { formatDateTime } from '$lib/dates';
  import { me } from '$lib/session';
  import { toasts } from '$lib/toasts';
  import { zeus } from '$lib/zeus';
  import IconReset from '~icons/mdi/refresh';
  import ButtonToggleActiveApp from '../ButtonToggleActiveApp.svelte';
  import FormApp, { type ThirdPartyApp } from '../FormApp.svelte';
  import type { PageData } from './$types';
  import { _query } from './+page';

  export let data: PageData;
  let loading = false;
  let {
    name,
    description,
    allowedRedirectUris,
    createdAt,
    faviconUrl,
    clientId,
    active,
    owner,
    website,
    secretLength,
  } = data.thirdPartyApp;

  let clientSecret: string | undefined;
  let clientSecretShown = true;

  let app: ThirdPartyApp = {
    name,
    description,
    allowedRedirectUris: allowedRedirectUris.join(' '),
    website,
    ownerGroup: owner,
  };

  function redact(textOrLength: string | number): string {
    return '\u2022'.repeat(typeof textOrLength === 'string' ? textOrLength.length : textOrLength);
  }

  async function rotateSecret() {
    await toasts.info('Es-tu sûr·e?', "L'ancien secret ne sera plus valide", {
      async action({ data: { id }, id: toastId }) {
        ({ rotateAppSecret: clientSecret } = await $zeus
          .mutate({
            rotateAppSecret: [{ id }, true],
          })
          .catch((error) => {
            toasts.error('Impossible de regénérer le secret', error.message);
            throw error;
          }));
        await toasts.remove(toastId);
        await toasts.success('Secret regénéré');
      },
      labels: {
        action: 'Confirmer',
        close: 'Annuler',
      },
      lifetime: Number.POSITIVE_INFINITY,
      data: {
        id: data.thirdPartyApp.id,
      },
    });
  }

  async function updateApp() {
    if (!app.ownerGroup) return;
    const { editApp } = await $zeus.mutate({
      editApp: [
        {
          id: data.thirdPartyApp.id,
          allowedRedirectUris: app.allowedRedirectUris.split(' '),
          description: app.description,
          name: app.name,
          ownerGroupUid: app.ownerGroup.uid,
          website: app.website,
        },
        _query,
      ],
    });

    if (active && !editApp.active) {
      await toasts.warn(
        'Validation nécéssaire',
        "L'application est de nouveau en attente de validation",
      );
    }

    ({ name, description, allowedRedirectUris, createdAt, faviconUrl, active, owner, website } =
      editApp);
  }
</script>

<main>
  <h1>
    <ButtonBack go="../"></ButtonBack>
    <img src={faviconUrl} alt="" class="favicon" />
    {name}
  </h1>
  <section class="metadata">
    <div class="status">
      <Badge theme={active ? 'success' : 'warning'}
        >{#if active}
          Active
        {:else}
          En attente de validation
        {/if}</Badge
      >
    </div>
    {#if $me?.admin}
      <ButtonToggleActiveApp {...data.thirdPartyApp}></ButtonToggleActiveApp>
    {/if}
    <div class="date">Créée le {formatDateTime(createdAt)}</div>
  </section>
  <section class="details">
    <dl>
      <dt><code> client_id </code></dt>
      <dd>
        <code>{clientId}</code>
        <ButtonCopyToClipboard text={clientId}></ButtonCopyToClipboard>
      </dd>
      <dt><code>client_secret</code></dt>
      <dd>
        {#if clientSecret}
          <code>{clientSecretShown ? clientSecret : redact(clientSecret)}</code>
          <ButtonToggleShow bind:shown={clientSecretShown}></ButtonToggleShow>
          <ButtonCopyToClipboard text={clientSecret}></ButtonCopyToClipboard>
          <Alert theme="danger"
            >Attention, garde bien ce secret, on ne peut pas te le re-donner ensuite.</Alert
          >
        {:else}
          <code>
            {redact(secretLength)}
          </code>
          <ButtonSecondary icon={IconReset} danger on:click={rotateSecret}
            >Regénérer</ButtonSecondary
          >
        {/if}
      </dd>
    </dl>
  </section>
  <section class="edit">
    <h2>Modifier</h2>
    <FormApp
      submitText="Modifier"
      on:submit={async () => {
        loading = true;
        try {
          await updateApp();
        } finally {
          loading = false;
        }
      }}
      {loading}
      bind:app
    >
      Si les URIs de redirection sont modifiées, un·e administrateur·rice devra valider les
      changements, et l'application sera désactivée jusqu'à validation.
    </FormApp>
  </section>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 800px;
    margin: 2rem auto;
  }

  h1 {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .metadata {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .favicon {
    height: 1.2em;
  }
</style>