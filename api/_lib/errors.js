/** An error whose message is safe to show to the signed-in user. */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message Safe, human-readable message
   * @param {string} [code] Short machine-readable code
   */
  constructor(status, message, code = 'ERROR') {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}
