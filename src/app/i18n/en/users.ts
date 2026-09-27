export const USERS: Record<string, string> = {
  // Users page & tabs
  'Akaunti zinazoweza kuingia kwenye mfumo, nyadhifa zao na moduli wanazofikia.':
    'Accounts that can sign in to the system, their roles and the modules they can access.',
  'Sehemu za watumiaji': 'User sections',

  // User list
  'Ongeza mtumiaji, mpe wadhifa na uchague moduli atakazoziona.':
    'Add a user, give them a role and choose the modules they will see.',
  'Ongeza mtumiaji': 'Add user',
  'Tafuta jina, simu au wadhifa…': 'Search name, phone or role…',
  'Nyadhifa zote': 'All roles',
  'Aliongezwa kuanzia': 'Added from',
  'Aliongezwa hadi': 'Added to',
  'Jina (A–Z)': 'Name (A–Z)',
  'Jina (Z–A)': 'Name (Z–A)',
  'Walioongezwa karibuni': 'Recently added',
  'Walioongezwa zamani': 'Oldest added',
  Aliongezwa: 'Added',
  'Bado hakuna watumiaji.': 'No users yet.',
  'Hakuna mtumiaji anayelingana na vichujio hivi.': 'No users match these filters.',
  'Watumiaji {shown} kati ya {total}': '{shown} of {total} users',
  'Muhtasari tu': 'Overview only',
  'Futa akaunti ya {name}? Hataweza kuingia tena.': 'Delete the account for {name}? They will no longer be able to sign in.',
  'Imeshindwa kumfuta mtumiaji huyo.': 'Could not delete that user.',
  'Imeshindwa kupakia watumiaji.': 'Could not load users.',

  // User dialog
  'Hariri mtumiaji': 'Edit user',
  'Mpe mtumiaji wadhifa wa {role}': 'Assign a user the role of {role}',
  'Ataweza kuingia kwa jina la mtumiaji na nenosiri hili, na ataona moduli utakazomchagulia tu.':
    'They will sign in with this username and password, and will only see the modules you choose for them.',
  'Jina linahitajika.': 'Name is required.',
  'Tumia herufi, namba, _ au - tu.': 'Use only letters, numbers, _ or -.',
  '(acha wazi kubaki na la zamani)': '(leave blank to keep the current one)',
  'Nenosiri liwe na herufi 4 au zaidi.': 'Password must be at least 4 characters.',
  'Namba ya simu': 'Phone number',
  'Weka namba ya simu sahihi.': 'Enter a valid phone number.',
  'Barua pepe': 'Email',
  '(hiari)': '(optional)',
  'Barua pepe si sahihi.': 'Invalid email address.',
  'Moduli anazoweza kufikia': 'Modules they can access',
  'Chagua/ondoa zote': 'Select/clear all',
  'Msimamizi anafikia moduli zote moja kwa moja.': 'An administrator automatically has access to all modules.',
  'Kila mtumiaji anaiona': 'Visible to every user',
  'Hifadhi mtumiaji': 'Save user',
  'Imeshindwa kuhifadhi mtumiaji huyo.': 'Could not save that user.',

  // Roles
  'Tafuta wadhifa…': 'Search roles…',
  'Ongeza wadhifa': 'Add role',
  'Hakuna wadhifa unaolingana na utafutaji huu.': 'No roles match this search.',
  'Hakuna maelezo.': 'No description.',
  'Watumiaji {count}': '{count} users',
  'Mpe mtumiaji wadhifa huu': 'Assign a user to this role',
  'Wahamishie watumiaji wadhifa mwingine kwanza': 'Move its users to another role first',
  'Futa wadhifa': 'Delete role',
  'Hariri wadhifa': 'Edit role',
  'Wadhifa utaonekana kwenye orodha unapoongeza mtumiaji.': 'The role will appear in the list when you add a user.',
  'Jina la wadhifa': 'Role name',
  'mf. Mhasibu': 'e.g. Accountant',
  'Jina la wadhifa linahitajika.': 'Role name is required.',
  'Hifadhi wadhifa': 'Save role',
  'Futa wadhifa wa {role}?': 'Delete the role {role}?',
  'Imeshindwa kuhifadhi wadhifa huo.': 'Could not save that role.',
  'Imeshindwa kufuta wadhifa huo.': 'Could not delete that role.',
  'Imeshindwa kupakia nyadhifa.': 'Could not load roles.',

  // Server messages (UserController / RoleController)
  'Huwezi kufuta akaunti yako mwenyewe.': 'You cannot delete your own account.',
  'Wadhifa wenye jina hili tayari upo.': 'A role with this name already exists.',
  'Wadhifa wenye jina hili ulifutwa. Urejeshe kutoka Kumbukumbu za shughuli.':
    'A role with this name was deleted. Restore it from the Activity logs.',
  'Wadhifa huu wa mfumo hauwezi kufutwa.': 'This system role cannot be deleted.',
  'Wadhifa huu una watumiaji. Wahamishie wadhifa mwingine kwanza.':
    'This role has users. Move them to another role first.',

  // Seeded role labels/descriptions (custom labels fall back to the stored text)
  Msimamizi: 'Administrator',
  Katibu: 'Secretary',
  'Mweka hazina': 'Treasurer',
  'Kiongozi wa kanda': 'Zone leader',
  'Kiongozi wa jumuiya': 'Community leader',
  Mwanachama: 'Member',
  'Ana ruhusa zote za mfumo.': 'Has full access to the system.',

  // Seeded module descriptions
  'Muhtasari wa takwimu za parokia.': 'Overview of parish statistics.',
  'Akaunti za watumiaji na nyadhifa zao.': 'User accounts and their roles.',
  'Kumbukumbu za sadaka na michango.': 'Records of offerings and contributions.',
  'Jumuiya ndogo ndogo na wanachama wake.': 'Small Christian Communities and their members.',
  'Kanda za parokia.': 'Parish zones.',
  'Kutuma SMS na arifa kwa waumini, jumuiya, kanda au watumiaji wa mfumo.':
    'Send SMS and notifications to parishioners, communities, zones or system users.',
  'Mipangilio ya mfumo na moduli zake.': 'System settings and modules.',
  'Nyeti: inaonyesha nani alifanya nini na lini. Mpe tu anayehitaji.':
    'Sensitive: shows who did what and when. Grant only to those who need it.',
};
