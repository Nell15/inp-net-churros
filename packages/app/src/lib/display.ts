import { DocumentType, type EventFrequency, type GroupType, type PaymentMethod } from './zeus';
import LogoLydia from '~icons/simple-icons/lydia';
import IconCreditCard from '~icons/mdi/credit-card-outline';
import IconCash from '~icons/mdi/hand-coin-outline';
import IconPaymentCheck from '~icons/mdi/checkbook';
import IconQuestionMark from '~icons/mdi/dots-horizontal';
import IconBankTransfer from '~icons/mdi/bank';
import type { SvelteComponent } from 'svelte';

export const DISPLAY_PAYMENT_METHODS = {
  Cash: 'Espèces',
  Check: 'Chèque',
  Card: 'Carte bancaire',
  Transfer: 'Virement',
  Lydia: 'Lydia',
  Other: 'Autre',
};

export const DISPLAY_VISIBILITIES = {
  Public: 'Public',
  Restricted: 'Restreint au groupe',
  Unlisted: 'Non répertorié',
  Private: 'Privé',
};

export const HELP_VISIBILITY = {
  Public: 'Visible par tous',
  Restricted: 'Visible par les membres du groupe',
  Unlisted: 'Visible par tout ceux qui possèdent le lien',
  Private: 'Visible par personne (excepté les administrateurs et organisateurs)',
};

export const DISPLAY_NOTIFICATION_TYPES = {
  NewArticle: 'Nouveau post',
  ShotgunOpeningSoon: "Ouverture imminente d'un shotgun",
  ShotgunOpened: "Ouverture d'un shotgun",
  ShotgunClosingSoon: "Fermeture imminente d'un shotgun",
  ShotgunClosed: "Fermeture d'un shotgun",
  GodparentRequestReceived: 'Réception de demandes de parrainage',
  GodparentRequestAccepted: 'Approbation de demandes de parrainage',
  GodparentRequestRefused: 'Refus de demandes de parrainage',
  PermissionsChanged: 'Modification de mes permissions',
  Other: 'Autres',
};

export const ORDER_NOTIFICATION_TYPES: Array<keyof typeof DISPLAY_NOTIFICATION_TYPES> = [
  'NewArticle',
  'ShotgunOpeningSoon',
  'ShotgunOpened',
  'ShotgunClosingSoon',
  'ShotgunClosed',
  'GodparentRequestReceived',
  'GodparentRequestAccepted',
  'GodparentRequestRefused',
  'PermissionsChanged',
];

export const DISPLAY_GROUP_TYPES: Record<GroupType, string> = {
  Association: 'Association',
  Club: 'Club',
  Group: 'Groupe',
  Integration: "Groupe d'inté",
  StudentAssociationSection: "Bureau de l'AE",
  List: 'Liste',
};

export const DISPLAY_MANAGER_PERMISSION_LEVELS = {
  readonly: 'Lecture seule',
  verifyer: 'Vérification des billets',
  editor: 'Modification',
  fullaccess: 'Gestion totale',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PAYMENT_METHODS_ICONS: Record<PaymentMethod, typeof SvelteComponent<any>> = {
  Card: IconCreditCard,
  Cash: IconCash,
  Check: IconPaymentCheck,
  Lydia: LogoLydia,
  Other: IconQuestionMark,
  Transfer: IconBankTransfer,
};

export const DISPLAY_EVENT_FREQUENCY: Record<EventFrequency, string> = {
  Biweekly: 'Bihebdomadaire',
  Monthly: 'Mensuel',
  Weekly: 'Hebdomadaire',
  Once: 'Une seule fois',
};

export const DISPLAY_DOCUMENT_TYPES = new Map<DocumentType, string>([
  [DocumentType.CourseNotes, 'Notes de cours'],
  [DocumentType.CourseSlides, 'Diapositives du cours'],
  [DocumentType.Exam, 'Partiel'],
  [DocumentType.Exercises, 'TD'],
  [DocumentType.GradedExercises, 'DM'],
  [DocumentType.Miscellaneous, 'Autre'],
  [DocumentType.Practical, 'TP'],
  [DocumentType.PracticalExam, 'BE'],
  [DocumentType.Summary, 'Fiche'],
]);

export const ORDER_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.Exam,
  DocumentType.Summary,
  DocumentType.CourseNotes,
  DocumentType.Exercises,
  DocumentType.GradedExercises,
  DocumentType.Practical,
  DocumentType.PracticalExam,
  DocumentType.CourseSlides,
  DocumentType.Miscellaneous,
];
