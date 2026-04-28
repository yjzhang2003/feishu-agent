/**
 * CardKit API manager for creating and updating card entities
 * Uses Feishu cardkit v1 API for card-in-place updates
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { log } from '../utils/logger.js';

export interface UpdateAction {
  action: 'partial_update_setting' | 'add_elements' | 'delete_elements' | 'partial_update_element' | 'update_element';
  params: object;
}

export class CardKitManager {
  private client: lark.Client;
  private domain: string;

  constructor(client: lark.Client, domain?: lark.Domain) {
    this.client = client;
    this.domain = domain === lark.Domain.Lark ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
  }

  private async getHeaders(): Promise<Record<string, string>> {
    // @ts-ignore tokenManager is any in SDK types
    const token = await this.client.tokenManager.getTenantAccessToken({});
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  /**
   * Create a card entity via cardkit API
   * Returns card_id for subsequent updates
   */
  async createCard(cardData: object): Promise<string | null> {
    try {
      const headers = await this.getHeaders();
      const cardJsonString = JSON.stringify(cardData);
      const requestBody = {
        type: 'card_json',
        data: cardJsonString,
      };
      log.info('cardkit', 'createCard request', {
        url: `${this.domain}/open-apis/cardkit/v1/cards`,
        cardJsonString,
        cardJsonLength: cardJsonString.length,
        headers,
      });

      const response = await this.client.httpInstance.post(
        `${this.domain}/open-apis/cardkit/v1/cards`,
        requestBody,
        { headers }
      );

      log.info('cardkit', 'createCard response', { status: response.status, data: response.data });

      // cardkit response may be { card_id } directly or { code, msg, data: { card_id } }
      const cardId = (response.data?.card_id as string | undefined)
        || (response.data?.data?.card_id as string | undefined);

      if (!cardId) {
        log.error('cardkit', 'Failed to create card', { code: response.data?.code, msg: response.data?.msg, data: response.data });
        return null;
      }

      log.info('cardkit', 'Card created', { cardId });
      return cardId;
    } catch (error) {
      const err = error as any;
      log.error('cardkit', 'Error creating card', {
        error: err.message,
        responseData: err.response?.data,
        responseStatus: err.response?.status,
      });
      return null;
    }
  }

  /**
   * Batch update a card entity
   * Requires strictly increasing sequence numbers per card
   */
  async batchUpdate(cardId: string, sequence: number, actions: UpdateAction[]): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await this.client.httpInstance.post(
        `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/batch_update`,
        {
          sequence,
          actions: JSON.stringify(actions),
        },
        { headers }
      );

      // Response may be { code: 0, msg: 'success' } or just empty success
      const code = response.data?.code as number | undefined;
      if (code !== undefined && code !== 0) {
        log.error('cardkit', 'Batch update failed', {
          cardId,
          sequence,
          code,
          msg: response.data?.msg,
        });
        return false;
      }

      log.info('cardkit', 'Card updated', { cardId, sequence, response: response.data });
      return true;
    } catch (error) {
      log.error('cardkit', 'Error updating card', { cardId, error: String(error) });
      return false;
    }
  }

  /**
   * Batch update with detailed debug logging
   */
  async batchUpdateDebug(
    cardId: string,
    sequence: number,
    actions: UpdateAction[]
  ): Promise<{ success: boolean; code?: number; msg?: string }> {
    try {
      const headers = await this.getHeaders();
      log.info('cardkit', 'Batch update request', {
        cardId,
        sequence,
        actionsCount: actions.length,
        actionsJson: JSON.stringify(actions),
      });

      const response = await this.client.httpInstance.post(
        `${this.domain}/open-apis/cardkit/v1/cards/${cardId}/batch_update`,
        {
          sequence,
          actions: JSON.stringify(actions),
        },
        { headers }
      );

      const code = response.data?.code as number | undefined;
      const msg = response.data?.msg as string | undefined;

      if (code !== undefined && code !== 0) {
        log.error('cardkit', 'Batch update failed', { cardId, sequence, code, msg, response: response.data });
        return { success: false, code, msg };
      }

      log.info('cardkit', 'Batch update succeeded', { cardId, sequence, response: response.data });
      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log.error('cardkit', 'Error updating card', { cardId, error: errMsg });
      return { success: false, msg: errMsg };
    }
  }
}
