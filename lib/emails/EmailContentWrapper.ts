/** Inner content area — matches Swipped table layout for email clients. */
export function EmailContentWrapper(content: string): string {
  return `
      <table class="es-content" style="width:650px; margin:auto; background-color:white;">
        <tbody>
          <tr>
            <td align="center">
              <table class="es-content-body" bgcolor="#ffffff" style="width:100%; background-color:white;">
                <tbody>
                  <tr>
                    <td align="left" style="padding-left:30px;padding-right:30px;padding-bottom:40px;">
                      ${content}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      `
}
