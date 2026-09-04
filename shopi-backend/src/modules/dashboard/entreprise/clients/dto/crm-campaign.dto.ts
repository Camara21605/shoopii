/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/clients/dto/crm-campaign.dto.ts
 * Section Clients & Abonnés — Actions CRM
 * ============================================================ */

import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const CRM_CAMPAIGN_TYPES = ['newsletter', 'fidelite', 'relance'] as const;
export type CrmCampaignType = (typeof CRM_CAMPAIGN_TYPES)[number];

export class SendCrmCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message: string;
}

export function isCrmCampaignType(value: string): value is CrmCampaignType {
  return (CRM_CAMPAIGN_TYPES as readonly string[]).includes(value);
}
